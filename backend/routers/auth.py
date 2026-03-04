"""
Auth routes - registered on the main api_router by server.py to keep server load order correct.
"""


def register_auth_routes(router):
    from fastapi import Request, Depends, HTTPException
    from fastapi.security import HTTPAuthorizationCredentials
    from pydantic import BaseModel

    from database import db
    import jwt as jwt_lib
    from server import (
        get_current_user,
        get_current_user_or_mfa_setup,
        _user_allowed_features,
        security,
        log_audit,
        hash_password,
        verify_password,
        create_access_token,
        create_mfa_temp_token,
        create_mfa_setup_temp_token,
        login_rate_limiter,
        JWT_SECRET,
        JWT_ALGORITHM,
        ALL_FEATURE_IDS,
        User,
        UserCreate,
        UserLogin,
        TokenResponse,
    )
    from crypto_utils import encrypt_field, decrypt_field
    from cache_utils import set_cached
    from config import settings as config_settings
    import os
    import logging
    import uuid
    from datetime import datetime, timezone, timedelta

    logger = logging.getLogger(__name__)

    class ChangePasswordBody(BaseModel):
        current_password: str
        new_password: str

    class ForgotPasswordBody(BaseModel):
        email: str

    class ResetPasswordBody(BaseModel):
        token: str
        new_password: str

    RESET_TOKEN_EXPIRE_HOURS = 1

    @router.post("/auth/register", response_model=User, tags=["Auth"])
    async def register_user(user_data: UserCreate):
        existing = await db.users.find_one({"email": user_data.email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        user_dict = user_data.model_dump()
        user_dict["password"] = hash_password(user_dict["password"])
        user_obj = User(**{k: v for k, v in user_dict.items() if k != "password"})
        user_dict["id"] = user_obj.id
        user_dict["created_at"] = user_obj.created_at.isoformat()
        user_dict["is_active"] = True
        if user_dict.get("phone"):
            user_dict["phone"] = encrypt_field(user_dict["phone"])
        await db.users.insert_one(user_dict)
        return user_obj

    @router.post("/auth/login", tags=["Auth"])
    async def login(credentials: UserLogin, request: Request):
        client_ip = request.client.host
        if not login_rate_limiter.is_allowed(client_ip):
            raise HTTPException(status_code=429, detail="Too many login attempts. Please try again later.")
        user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
        if not user or not verify_password(credentials.password, user["password"]):
            await log_audit("login_failed", "auth", details={"email": credentials.email}, request=request)
            raise HTTPException(status_code=401, detail="Invalid credentials")
        user_response = {k: v for k, v in user.items() if k not in ("password", "mfa_totp_secret")}

        # 2FA is applied only when system allows it and (user has no company or company has mfa_required)
        system_doc = await db.system_settings.find_one({"id": "main"}, {"_id": 0, "mfa_enabled": 1})
        mfa_system_enabled = bool(system_doc.get("mfa_enabled", False)) if system_doc else False
        company_mfa_required = False
        company_id = user.get("company_id")
        if company_id:
            company = await db.companies.find_one({"id": company_id}, {"_id": 0, "mfa_required": 1})
            company_mfa_required = bool(company.get("mfa_required", False)) if company else False
        apply_mfa = mfa_system_enabled and (not company_id or company_mfa_required)

        if not apply_mfa:
            token_version = user.get("token_version", 0)
            token = create_access_token({"user_id": user["id"], "role": user["role"]}, token_version=token_version)
            idle_ttl = config_settings.session_idle_timeout_minutes * 60
            set_cached("idle:" + user["id"], "1", ttl_seconds=idle_ttl)
            await log_audit("login_success", "auth", user=user_response, request=request)
            return TokenResponse(access_token=token, user=user_response)

        if user.get("mfa_enabled") and user.get("mfa_totp_secret"):
            temp_token = create_mfa_temp_token(user["id"])
            await log_audit("login_mfa_required", "auth", user=user_response, request=request)
            return {"requires_mfa": True, "temp_token": temp_token, "user": {"id": user["id"], "email": user["email"]}}
        temp_token = create_mfa_setup_temp_token(user["id"])
        await log_audit("login_mfa_setup_required", "auth", user=user_response, request=request)
        return {"requires_mfa_setup": True, "temp_token": temp_token, "user": {"id": user["id"], "email": user["email"]}}

    @router.post("/auth/change-password", tags=["Auth"])
    async def change_password(
        body: ChangePasswordBody,
        request: Request,
        current_user: dict = Depends(get_current_user),
    ):
        user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
        if not user or not verify_password(body.current_password, user["password"]):
            await log_audit("change_password_failed", "auth", user=current_user, request=request)
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        new_hash = hash_password(body.new_password)
        await db.users.update_one({"id": current_user["id"]}, {"$set": {"password": new_hash}})
        await log_audit("change_password", "auth", resource_id=current_user["id"], user=current_user, request=request)
        return {"message": "Password updated successfully"}

    @router.post("/auth/forgot-password", tags=["Auth"])
    async def forgot_password(body: ForgotPasswordBody, request: Request):
        client_ip = request.client.host
        if not login_rate_limiter.is_allowed(client_ip):
            raise HTTPException(status_code=429, detail="Too many requests. Try again later.")
        user = await db.users.find_one({"email": body.email}, {"id": 1, "email": 1})
        msg = "If an account exists with this email, you will receive a password reset link."
        if not user:
            return {"message": msg}
        reset_token = str(uuid.uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)
        await db.password_reset_tokens.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "token": reset_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        base_url = os.environ.get("FRONTEND_URL", request.base_url.rstrip("/").replace("/api", ""))
        reset_link = f"{base_url}/reset-password?token={reset_token}"
        logger.info("Password reset requested for email=%s (link sent via env/config)", body.email)
        return {"message": msg}

    @router.post("/auth/reset-password", tags=["Auth"])
    async def reset_password(body: ResetPasswordBody, request: Request):
        client_ip = request.client.host
        if not login_rate_limiter.is_allowed(client_ip):
            raise HTTPException(status_code=429, detail="Too many requests. Try again later.")
        now = datetime.now(timezone.utc)
        record = await db.password_reset_tokens.find_one({
            "token": body.token,
            "expires_at": {"$gt": now},
        })
        if not record:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        new_hash = hash_password(body.new_password)
        await db.users.update_one({"id": record["user_id"]}, {"$set": {"password": new_hash}})
        await db.password_reset_tokens.delete_many({"token": body.token})
        await log_audit("reset_password", "auth", resource_id=record["user_id"], request=request)
        return {"message": "Password has been reset. You can log in with your new password."}

    @router.post("/auth/logout", tags=["Auth"])
    async def logout(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
        try:
            payload = jwt_lib.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("user_id")
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0}) if user_id else None
            await log_audit("logout", "auth", user=user, request=request)
        except Exception:
            pass
        return {"message": "Logged out"}

    @router.post("/auth/logout-all", tags=["Auth"])
    async def logout_all(request: Request, current_user: dict = Depends(get_current_user)):
        new_version = current_user.get("token_version", 0) + 1
        await db.users.update_one({"id": current_user["id"]}, {"$set": {"token_version": new_version}})
        await log_audit("logout_all", "auth", resource_id=current_user["id"], user=current_user, request=request)
        return {"message": "Logged out from all devices. Please log in again."}

    @router.get("/auth/me", tags=["Auth"])
    async def get_me(current_user: dict = Depends(get_current_user)):
        return current_user

    # ---------- MFA (TOTP) - optional, for HIPAA / best practices ----------
    class MFASetupResponse(BaseModel):
        secret: str
        provisioning_uri: str

    class MFAVerifyBody(BaseModel):
        code: str

    class MFAChallengeBody(BaseModel):
        temp_token: str
        code: str

    class MFADisableBody(BaseModel):
        password: str

    @router.post("/auth/mfa/setup", response_model=MFASetupResponse, tags=["Auth"])
    async def mfa_setup(request: Request, current_user: dict = Depends(get_current_user_or_mfa_setup)):
        """Generate TOTP secret and store encrypted. Return secret and provisioning_uri for authenticator app."""
        import pyotp
        secret = pyotp.random_base32()
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(name=current_user.get("email", ""), issuer_name="Tebbi")
        encrypted_secret = encrypt_field(secret)
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"mfa_totp_secret": encrypted_secret, "mfa_enabled": False}}
        )
        await log_audit("mfa_setup", "auth", resource_id=current_user["id"], user=current_user, request=request)
        return MFASetupResponse(secret=secret, provisioning_uri=provisioning_uri)

    @router.post("/auth/mfa/verify", tags=["Auth"])
    async def mfa_verify(
        body: MFAVerifyBody,
        request: Request,
        current_user: dict = Depends(get_current_user_or_mfa_setup),
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        """Verify TOTP code and enable MFA for this user. If token was mfa_setup_pending, returns full TokenResponse."""
        import pyotp
        user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "mfa_totp_secret": 1, "token_version": 1})
        if not user or not user.get("mfa_totp_secret"):
            raise HTTPException(status_code=400, detail="MFA not set up. Call /auth/mfa/setup first.")
        raw_secret = decrypt_field(user["mfa_totp_secret"]) or user["mfa_totp_secret"]
        totp = pyotp.TOTP(raw_secret)
        if not totp.verify(body.code, valid_window=1):
            await log_audit("mfa_verify_failed", "auth", user=current_user, request=request)
            raise HTTPException(status_code=400, detail="Invalid code")
        await db.users.update_one({"id": current_user["id"]}, {"$set": {"mfa_enabled": True}})
        await log_audit("mfa_enabled", "auth", resource_id=current_user["id"], user=current_user, request=request)
        try:
            payload = jwt_lib.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            if payload.get("mfa_setup_pending"):
                full_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
                if full_user:
                    full_user.pop("password", None)
                    full_user.pop("mfa_totp_secret", None)
                    if full_user.get("phone"):
                        full_user["phone"] = decrypt_field(full_user["phone"])
                    role = (full_user.get("role") or "").strip()
                    full_user["role"] = role
                    company_id = full_user.get("company_id")
                    if company_id:
                        company = await db.companies.find_one({"id": company_id}, {"_id": 0, "features": 1, "custom_permissions": 1})
                        full_user["company_features"] = (company or {}).get("features") or {}
                        full_user["allowed_features"] = _user_allowed_features(full_user, company)
                    else:
                        full_user["company_features"] = {}
                        full_user["allowed_features"] = list(ALL_FEATURE_IDS) if role == "super_admin" else []
                    if role == "super_admin":
                        full_user["allowed_features"] = list(ALL_FEATURE_IDS)
                    token_version = full_user.get("token_version", 0)
                    token = create_access_token({"user_id": full_user["id"], "role": full_user["role"]}, token_version=token_version)
                    idle_ttl = config_settings.session_idle_timeout_minutes * 60
                    set_cached("idle:" + full_user["id"], "1", ttl_seconds=idle_ttl)
                    return TokenResponse(access_token=token, user=full_user)
        except Exception:
            pass
        return {"message": "MFA enabled"}

    @router.post("/auth/mfa/challenge", response_model=TokenResponse, tags=["Auth"])
    async def mfa_challenge(body: MFAChallengeBody, request: Request):
        """Exchange temp_token + TOTP code for full access token (after login when MFA is required)."""
        import pyotp
        try:
            payload = jwt_lib.decode(body.temp_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt_lib.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid or expired temporary token")
        if not payload.get("mfa_pending") or not payload.get("user_id"):
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = payload["user_id"]
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user or not user.get("mfa_enabled") or not user.get("mfa_totp_secret"):
            raise HTTPException(status_code=401, detail="MFA not enabled for this user")
        raw_secret = decrypt_field(user["mfa_totp_secret"]) or user["mfa_totp_secret"]
        totp = pyotp.TOTP(raw_secret)
        if not totp.verify(body.code, valid_window=1):
            await log_audit("mfa_challenge_failed", "auth", details={"user_id": user_id}, request=request)
            raise HTTPException(status_code=401, detail="Invalid code")
        token_version = user.get("token_version", 0)
        token = create_access_token({"user_id": user["id"], "role": user["role"]}, token_version=token_version)
        user_response = {k: v for k, v in user.items() if k not in ("password", "mfa_totp_secret")}
        idle_ttl = config_settings.session_idle_timeout_minutes * 60
        set_cached("idle:" + user["id"], "1", ttl_seconds=idle_ttl)
        await log_audit("login_success", "auth", user=user_response, request=request)
        return TokenResponse(access_token=token, user=user_response)

    @router.post("/auth/mfa/disable", tags=["Auth"])
    async def mfa_disable(body: MFADisableBody, request: Request, current_user: dict = Depends(get_current_user)):
        """Disable MFA after verifying password. Only super_admin may disable MFA (policy)."""
        if current_user.get("role") != "super_admin":
            raise HTTPException(status_code=403, detail="Only super administrators may disable MFA")
        user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 1})
        if not user or not verify_password(body.password, user["password"]):
            await log_audit("mfa_disable_failed", "auth", user=current_user, request=request)
            raise HTTPException(status_code=400, detail="Incorrect password")
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$unset": {"mfa_totp_secret": "", "mfa_enabled": ""}}
        )
        await log_audit("mfa_disabled", "auth", resource_id=current_user["id"], user=current_user, request=request)
        return {"message": "MFA disabled"}
