from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import base64
from enum import Enum
import asyncio
import random
import json
import subprocess
import sys
from contextlib import asynccontextmanager
from collections import defaultdict
import time

from config import settings as app_settings
from database import db
from crypto_utils import encrypt_field, decrypt_field
from cache_utils import get_cached, set_cached, _make_key, invalidate_pattern, _DEFAULT_TTL, _DASHBOARD_TTL
from ai_utils import (
    count_tokens_openai,
    ensure_context_fits,
    build_visits_context_with_summary,
    DEFAULT_MAX_CONTEXT_TOKENS,
    DEFAULT_MAX_OUTPUT_TOKENS,
)

_IDLE_CACHE_PREFIX = "idle:"

# PHI fields encrypted at rest (must decrypt when reading for display/export)
_PHI_FIELDS = ("phone", "emergency_phone", "address", "address_ar", "emergency_contact", "chronic_conditions", "chronic_conditions_ar")

def _decrypt_patient_phi(patient: dict) -> dict:
    """Decrypt PHI fields on a patient dict (in-place). Use when returning or using patient data."""
    if not patient:
        return patient
    for field in _PHI_FIELDS:
        if patient.get(field):
            patient[field] = decrypt_field(patient[field])
    return patient

# JWT Config (from central config)
JWT_SECRET = app_settings.jwt_secret
JWT_ALGORITHM = app_settings.jwt_algorithm
JWT_EXPIRATION_HOURS = app_settings.jwt_expiration_hours

if app_settings.is_jwt_default:
    logging.warning(
        "Security: JWT_SECRET is using default. Set JWT_SECRET in production to a strong random value (e.g. 32+ chars)."
    )

# ==================== FEATURES & PERMISSIONS (على مستوى العيادة + الصلاحيات حسب الدور) ====================
# الميزات: تفعيل/تعطيل على مستوى العيادة. الصلاحيات: ما الذي يستطيع كل دور الوصول إليه.
ALL_FEATURE_IDS = [
    "dashboard", "patients", "appointments", "queue", "invoices", "ai_analysis", "reports",
    "online_booking", "notifications", "pdf_printing", "backup", "pharmacy", "consent", "marketing", "audit_logs"
]
# لكل ميزة: قائمة الصلاحيات التي تعطي الوصول (فارغة = فقط تفعيل الميزة للعيادة يكفي)
FEATURE_TO_PERMISSIONS = {
    "dashboard": [],  # كل موظف يرى لوحة التحكم إذا مفعلة للعيادة
    "patients": ["view_patients", "edit_patients", "add_patients"],
    "appointments": ["view_appointments", "manage_appointments"],
    "queue": ["view_appointments", "manage_appointments"],
    "pharmacy": ["view_patients", "manage_pharmacy"],
    "consent": ["view_patients", "edit_patients"],
    "invoices": ["view_invoices", "create_invoices"],
    "ai_analysis": ["use_ai"],
    "reports": ["view_reports"],
    "online_booking": ["manage_appointments", "all"],
    "notifications": ["all"],
    "pdf_printing": [],  # أي موظف إذا مفعل للعيادة
    "backup": ["all"],
    "marketing": ["all"],
    "audit_logs": ["all"],
}
DEFAULT_ROLE_PERMISSIONS = {
    "super_admin": ["all"],
    "company_admin": ["all"],
    "doctor": ["view_patients", "edit_patients", "add_visits", "view_appointments", "manage_appointments", "use_ai", "manage_pharmacy"],
    "nurse": ["view_patients", "add_vitals", "view_appointments", "manage_pharmacy"],
    "receptionist": ["view_patients", "add_patients", "manage_appointments", "manage_pharmacy"],
    "accountant": ["view_invoices", "create_invoices", "view_reports"],
}

def _user_allowed_features(user: dict, company: Optional[dict]) -> List[str]:
    """يعيد قائمة الميزات المسموح للمستخدم برؤيتها: مفعلة للعيادة + الصلاحيات تطابق."""
    if not user:
        return []
    role = user.get("role") or ""
    if role == "super_admin":
        return list(ALL_FEATURE_IDS)
    if not company:
        return []
    features = company.get("features") or {}
    perms_map = (company.get("custom_permissions") or {}).copy()
    for r, perms in DEFAULT_ROLE_PERMISSIONS.items():
        perms_map.setdefault(r, perms)
    role_permissions = perms_map.get(role) or []
    if "all" in role_permissions:
        return [f for f in ALL_FEATURE_IDS if features.get(f, True)]
    allowed = []
    for fid in ALL_FEATURE_IDS:
        if not features.get(fid, True):
            continue
        required = FEATURE_TO_PERMISSIONS.get(fid, [])
        if not required:
            allowed.append(fid)
            continue
        if any(p in role_permissions for p in required):
            allowed.append(fid)
    return allowed

# Background task flag
reminder_task_running = False

# ==================== AUTO REMINDER SYSTEM ====================

def _get_reminder_message(settings: dict, booking: dict, company: dict, template_key: str = "booking_reminder", default_template: str = None, portal_link: str = ""):
    """Build reminder message from template and placeholders. Use portal_link for {portal_link}."""
    defaults = {
        "booking_reminder": "تذكير من {clinic_name}: مرحباً {patient_name}، موعدك يوم {date} الساعة {time}. رمز الحجز: {confirmation_code}. نتطلع لرؤيتك!",
        "booking_reminder_2h": "تذكير: موعدك في {clinic_name} بعد ساعتين - {date} الساعة {time}. رمز الحجز: {confirmation_code}.",
    }
    template = (settings.get("templates") or {}).get(template_key, default_template or defaults.get(template_key, defaults["booking_reminder"]))
    if not template:
        template = "مرحباً {patient_name}، التاريخ: {date} الوقت: {time}. رمز: {confirmation_code}. {portal_link}"
    message = template.replace("{patient_name}", booking.get("patient_name", ""))
    message = message.replace("{clinic_name}", company.get("name_ar", company.get("name", "")))
    message = message.replace("{doctor_name}", booking.get("doctor_name", ""))
    message = message.replace("{date}", booking.get("date", ""))
    message = message.replace("{time}", booking.get("time", ""))
    message = message.replace("{confirmation_code}", booking.get("confirmation_code", ""))
    message = message.replace("{portal_link}", portal_link or "")
    return message


async def send_patient_sms_whatsapp(settings: dict, phone: str, message: str) -> bool:
    """Send a message to patient via SMS and/or WhatsApp (uses reminder_channel from settings)."""
    try:
        from twilio.rest import Client
        if not phone or not settings.get("twilio_account_sid") or not settings.get("twilio_auth_token"):
            return False
        client = Client(settings["twilio_account_sid"], decrypt_field(settings["twilio_auth_token"]))
        channel = settings.get("reminder_channel", "sms")
        if channel in ["sms", "both"] and settings.get("twilio_phone_number"):
            try:
                client.messages.create(body=message, from_=settings["twilio_phone_number"], to=phone)
                logger.info(f"Portal link SMS sent to {phone}")
            except Exception as e:
                logger.error(f"Portal SMS error: {e}")
        if channel in ["whatsapp", "both"] and settings.get("whatsapp_connected") and settings.get("whatsapp_number"):
            try:
                whatsapp_from = settings.get("whatsapp_number", "")
                if not whatsapp_from.startswith("whatsapp:"):
                    whatsapp_from = f"whatsapp:{whatsapp_from}"
                whatsapp_to = f"whatsapp:{phone}" if not phone.startswith("whatsapp:") else phone
                client.messages.create(body=message, from_=whatsapp_from, to=whatsapp_to)
                logger.info(f"Portal link WhatsApp sent to {phone}")
            except Exception as e:
                logger.error(f"Portal WhatsApp error: {e}")
        return True
    except Exception as e:
        logger.error(f"send_patient_sms_whatsapp: {e}")
        return False


async def _resolve_portal_link_for_booking(booking: dict, company_id: str) -> str:
    """If booking has patient_id or we find patient by phone, create one-time portal link and return it."""
    patient_id = booking.get("patient_id")
    if not patient_id:
        phone = decrypt_field(booking.get("patient_phone")) or booking.get("patient_phone") or ""
        if phone:
            cursor = db.patients.find({"company_id": company_id}, {"_id": 0, "id": 1, "phone": 1})
            async for p in cursor:
                if decrypt_field(p.get("phone")) == phone or p.get("phone") == phone:
                    patient_id = p.get("id")
                    break
    if not patient_id:
        return ""
    one_time_token = str(uuid.uuid4()).replace("-", "")[:16]
    doc = {
        "token": one_time_token,
        "patient_id": patient_id,
        "company_id": company_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "used_at": None,
    }
    await db.patient_portal_tokens.insert_one(doc)
    base_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    return f"{base_url}/portal?token={one_time_token}"


async def send_reminder_message(settings: dict, booking: dict, company: dict, template_key: str = "booking_reminder"):
    """Send reminder message via SMS or WhatsApp. template_key: booking_reminder or booking_reminder_2h."""
    try:
        from twilio.rest import Client

        if not settings.get("twilio_account_sid") or not settings.get("twilio_auth_token"):
            return False

        template = (settings.get("templates") or {}).get(template_key, "")
        portal_link = ""
        if "{portal_link}" in template:
            portal_link = await _resolve_portal_link_for_booking(booking, company.get("id", ""))
        message = _get_reminder_message(settings, booking, company, template_key, portal_link=portal_link)

        client = Client(settings["twilio_account_sid"], decrypt_field(settings.get("twilio_auth_token")) or settings.get("twilio_auth_token"))
        phone = decrypt_field(booking.get("patient_phone")) or booking.get("patient_phone", "")
        if not phone:
            return False
        
        channel = settings.get("reminder_channel", "sms")
        
        # Send SMS
        if channel in ["sms", "both"] and settings.get("sms_connected"):
            try:
                client.messages.create(
                    body=message,
                    from_=settings.get("twilio_phone_number"),
                    to=phone
                )
                logger.info(f"SMS reminder sent to {phone}")
            except Exception as e:
                logger.error(f"SMS send error: {e}")
        
        # Send WhatsApp
        if channel in ["whatsapp", "both"] and settings.get("whatsapp_connected"):
            try:
                whatsapp_from = settings.get("whatsapp_number", "")
                if not whatsapp_from.startswith("whatsapp:"):
                    whatsapp_from = f"whatsapp:{whatsapp_from}"
                whatsapp_to = f"whatsapp:{phone}" if not phone.startswith("whatsapp:") else phone
                
                client.messages.create(
                    body=message,
                    from_=whatsapp_from,
                    to=whatsapp_to
                )
                logger.info(f"WhatsApp reminder sent to {phone}")
            except Exception as e:
                logger.error(f"WhatsApp send error: {e}")
        
        return True
    except Exception as e:
        logger.error(f"Reminder send error: {e}")
        return False

def _parse_booking_datetime(booking: dict):
    """Return (date, time) as datetime in UTC (naive, for comparison). Uses company timezone if needed - simplified: assume local day+time as UTC for window check."""
    d = booking.get("date", "")
    t = booking.get("time", "09:00")
    if not d:
        return None
    try:
        from datetime import datetime as dt
        return dt.fromisoformat(f"{d}T{t}:00").replace(tzinfo=timezone.utc)
    except Exception:
        return None


async def process_auto_reminders():
    """Process and send auto reminders for upcoming appointments. Sends within 1 hour of target reminder time (e.g. 24h or 2h before appointment)."""
    try:
        companies_settings = await db.notification_settings.find({"auto_reminder_enabled": True}).to_list(1000)
        now = datetime.now(timezone.utc)

        for settings in companies_settings:
            company_id = settings.get("company_id")
            if not company_id:
                continue
            company = await db.companies.find_one({"id": company_id})
            if not company:
                continue

            hours_before = settings.get("reminder_hours_before", 24)
            reminder_2h_enabled = settings.get("reminder_2h_enabled", False)

            # Fetch confirmed bookings for this company that might be in window (next 25h for 24h reminder, next 3h for 2h)
            from_d = (now + timedelta(hours=1)).strftime("%Y-%m-%d")
            to_d = (now + timedelta(hours=26)).strftime("%Y-%m-%d")
            cursor = db.online_bookings.find({
                "company_id": company_id,
                "status": "confirmed",
                "date": {"$gte": from_d, "$lte": to_d},
            })
            bookings = await cursor.to_list(200)

            for booking in bookings:
                appt_dt = _parse_booking_datetime(booking)
                if not appt_dt:
                    continue

                # 24h reminder: send if reminder time (appt - 24h) is in [now - 10m, now + 50m] so we send once within ~1h window
                reminder_due_24 = appt_dt - timedelta(hours=hours_before)
                if now >= reminder_due_24 - timedelta(minutes=10) and now <= reminder_due_24 + timedelta(minutes=50):
                    if not booking.get("reminder_sent"):
                        success = await send_reminder_message(settings, booking, company, "booking_reminder")
                        if success:
                            await db.online_bookings.update_one(
                                {"id": booking["id"]},
                                {"$set": {"reminder_sent": True, "reminder_sent_at": now.isoformat()}}
                            )
                            logger.info(f"Reminder (24h) sent for booking {booking.get('confirmation_code')}")

                # 2h reminder
                if reminder_2h_enabled:
                    reminder_due_2h = appt_dt - timedelta(hours=2)
                    if now >= reminder_due_2h - timedelta(minutes=10) and now <= reminder_due_2h + timedelta(minutes=50):
                        if not booking.get("reminder_2h_sent"):
                            success = await send_reminder_message(settings, booking, company, "booking_reminder_2h")
                            if success:
                                await db.online_bookings.update_one(
                                    {"id": booking["id"]},
                                    {"$set": {"reminder_2h_sent": True, "reminder_2h_sent_at": now.isoformat()}}
                                )
                                logger.info(f"Reminder (2h) sent for booking {booking.get('confirmation_code')}")

    except Exception as e:
        logger.error(f"Auto reminder processing error: {e}")

async def reminder_background_task():
    """Background task that runs every hour to send reminders"""
    global reminder_task_running
    reminder_task_running = True
    
    while reminder_task_running:
        try:
            logger.info("Running auto reminder check...")
            await process_auto_reminders()
        except Exception as e:
            logger.error(f"Reminder task error: {e}")
        
        # Wait 1 hour before next check
        await asyncio.sleep(3600)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Tebbi Medical System...")
    # Production: refuse to start if JWT_SECRET, ENCRYPTION_KEY, or CORS are unsafe
    app_settings.validate_production()
    # Auto-seed if database has no users (first run or empty DB)
    try:
        user_count = await db.users.count_documents({})
        logger.info("Database has %s user(s).", user_count)
        if user_count == 0:
            logger.info("Database empty: running seed to create initial users...")
            await run_seed()
            logger.info("Seed completed. Log in with: superadmin@tebbi.com / super123  or  doctor@tebbi.com / doctor123")
        else:
            logger.info("Seed skipped (users already exist).")
    except Exception as e:
        logger.warning("Auto-seed check failed (is MongoDB running on MONGO_URL?). %s", e)
        logger.warning("To create users manually: open http://localhost:8001/docs and call POST /api/seed")
    # Start reminder background task
    asyncio.create_task(reminder_background_task())
    yield
    # Shutdown
    global reminder_task_running
    reminder_task_running = False
    logger.info("Shutting down...")

# Create the main app with lifespan; hide docs in production
_docs_url = None if app_settings.production else "/docs"
_redoc_url = None if app_settings.production else "/redoc"
app = FastAPI(
    title="Tebbi Medical System",
    lifespan=lifespan,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    openapi_tags=[
        {"name": "Auth", "description": "تسجيل الدخول، التسجيل، تغيير كلمة المرور، MFA، تسجيل الخروج"},
        {"name": "Health", "description": "Liveness و Readiness للـ Docker/K8s"},
        {"name": "Users", "description": "المستخدمون والأدوار والصلاحيات"},
        {"name": "Patients", "description": "المرضى، الحساسيات، التشخيصات، الأدوية، الصور الطبية"},
        {"name": "Appointments", "description": "المواعيد، الطابور، الجلسات عن بُعد"},
        {"name": "Invoices", "description": "الفواتير، المصروفات، المحاسبة"},
        {"name": "Consent", "description": "نماذج الموافقة وتوقيعها"},
        {"name": "Inventory", "description": "المخزون والصيدلية"},
        {"name": "Companies", "description": "الشركات/العيادات، الاشتراكات، الموظفون، النسخ الاحتياطي"},
        {"name": "Audit", "description": "سجلات التدقيق للوصول إلى البيانات"},
        {"name": "AI", "description": "تحليل الأعراض، الصور، التقارير، التنبيهات"},
        {"name": "Public", "description": "الحجز العام، العيادات، الأطباء، المراجعات"},
        {"name": "Portal", "description": "بوابة المريض والمواعيد والرسائل"},
        {"name": "Notifications", "description": "الإشعارات والإعدادات"},
    ],
)
api_router = APIRouter(prefix="/api")
security = HTTPBearer()


@app.get("/seed-demo-patients")
def _seed_demo_check():
    """أول مسار يُسجّل — لو فتحت الرابط تشوف 200 وتتأكد إن الخادم يقرأ هذا الملف."""
    return {"ok": True, "message": "استخدم POST من التطبيق لتحميل المرضى", "method": "POST"}

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== ENUMS ====================
class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"  # مدير النظام
    COMPANY_ADMIN = "company_admin"  # مدير الشركة/العيادة
    DOCTOR = "doctor"  # طبيب
    NURSE = "nurse"  # ممرض
    RECEPTIONIST = "receptionist"  # موظف استقبال
    ACCOUNTANT = "accountant"  # محاسب
    ADMIN = "admin"  # للتوافق مع القديم

class SubscriptionStatus(str, Enum):
    TRIAL = "trial"
    ACTIVE = "active"
    EXPIRED = "expired"
    SUSPENDED = "suspended"

class Specialty(str, Enum):
    GENERAL = "general"
    CARDIOLOGY = "cardiology"
    DERMATOLOGY = "dermatology"
    PEDIATRICS = "pediatrics"
    ORTHOPEDICS = "orthopedics"
    GYNECOLOGY = "gynecology"
    OPHTHALMOLOGY = "ophthalmology"
    ENT = "ent"
    NEUROLOGY = "neurology"
    PSYCHIATRY = "psychiatry"
    DENTISTRY = "dentistry"
    INTERNAL = "internal"
    SURGERY = "surgery"
    OTHER = "other"

class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"

class AppointmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    PARTIAL = "partial"

class ImageType(str, Enum):
    XRAY = "xray"
    ECG = "ecg"
    LAB_TEST = "lab_test"
    OTHER = "other"

# ==================== MULTI-TENANT MODELS ====================

# Company/Clinic Model (المستأجر)
class CompanyBase(BaseModel):
    name: str
    name_ar: Optional[str] = None
    code: str  # رمز فريد للشركة
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    address_ar: Optional[str] = None
    logo_base64: Optional[str] = None
    website: Optional[str] = None
    specialty: Optional[str] = None  # التخصص الرئيسي
    
class CompanyCreate(CompanyBase):
    admin_name: str
    admin_email: str
    admin_password: str

class Company(CompanyBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    # Subscription
    subscription_status: SubscriptionStatus = SubscriptionStatus.TRIAL
    subscription_end_date: Optional[datetime] = None
    trial_days: int = 14
    # Limits
    max_users: int = 5
    max_patients: int = 1000
    max_storage_mb: int = 1024
    # Features (ميزات العيادة: تفعيل/تعطيل من السوبر أدمن)
    features: dict = Field(default_factory=lambda: {
        "dashboard": True,
        "patients": True,
        "appointments": True,
        "queue": True,
        "invoices": True,
        "ai_analysis": True,
        "reports": True,
        "online_booking": True,
        "notifications": True,
        "pdf_printing": True,
        "backup": True,
        "pharmacy": True,
        "consent": True,
        "marketing": True,
        "audit_logs": True,
    })
    # Stats
    users_count: int = 0
    patients_count: int = 0
    storage_used_mb: float = 0

# Staff Member Model (موظف في الشركة)
class StaffBase(BaseModel):
    name: str
    name_ar: Optional[str] = None
    email: str
    phone: Optional[str] = None
    role: UserRole = UserRole.DOCTOR
    specialty: Optional[str] = None
    specialty_ar: Optional[str] = None
    bio: Optional[str] = None
    bio_ar: Optional[str] = None
    photo_base64: Optional[str] = None
    consultation_fee: Optional[float] = None
    working_hours: Optional[dict] = None  # {"sunday": {"start": "09:00", "end": "17:00"}, ...}
    is_available_online: bool = True

class StaffCreate(StaffBase):
    password: str
    company_id: str

class Staff(StaffBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

# Online Booking Model
class OnlineBookingBase(BaseModel):
    patient_name: str
    patient_phone: str
    patient_email: Optional[str] = None
    doctor_id: str
    company_id: str
    date: str
    time: str
    reason: Optional[str] = None
    notes: Optional[str] = None

class OnlineBooking(OnlineBookingBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: AppointmentStatus = AppointmentStatus.SCHEDULED
    confirmation_code: str = Field(default_factory=lambda: str(uuid.uuid4())[:8].upper())

# ==================== MODELS ====================

# User Models
class UserBase(BaseModel):
    email: str
    name: str
    name_ar: Optional[str] = None
    role: UserRole = UserRole.DOCTOR
    phone: Optional[str] = None
    specialty: Optional[str] = None
    specialty_ar: Optional[str] = None
    company_id: Optional[str] = None  # للربط مع الشركة

class UserCreate(UserBase):
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    photo_base64: Optional[str] = None
    bio: Optional[str] = None
    consultation_fee: Optional[float] = None
    is_available_online: bool = True
    working_hours: Optional[dict] = None

class UserLogin(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

# Patient Models
class PatientBase(BaseModel):
    name: str
    name_ar: Optional[str] = None
    national_id: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[Gender] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    address_ar: Optional[str] = None
    blood_type: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    chronic_conditions: Optional[str] = None
    chronic_conditions_ar: Optional[str] = None
    # Pregnancy fields
    is_pregnant: Optional[bool] = None
    pregnancy_weeks: Optional[int] = None
    # Vital signs
    temperature: Optional[float] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    heart_rate: Optional[int] = None
    oxygen_saturation: Optional[int] = None
    # Initial allergies
    initial_allergies: Optional[List[str]] = None

class PatientCreate(PatientBase):
    pass

class Patient(PatientBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_visit_date: Optional[str] = None  # Set when returning list (from last visit created_at)

# Allergy Model
class AllergyBase(BaseModel):
    patient_id: str
    allergen: str
    allergen_ar: Optional[str] = None
    severity: str = "moderate"
    reaction: Optional[str] = None
    reaction_ar: Optional[str] = None

class AllergyCreate(AllergyBase):
    pass

class Allergy(AllergyBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Diagnosis Model
class DiagnosisBase(BaseModel):
    patient_id: str
    doctor_id: Optional[str] = None
    diagnosis_code: Optional[str] = None
    diagnosis: str
    diagnosis_ar: Optional[str] = None
    notes: Optional[str] = None
    notes_ar: Optional[str] = None
    is_ai_suggested: bool = False

class DiagnosisCreate(DiagnosisBase):
    pass

class Diagnosis(DiagnosisBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Medication Model
class MedicationBase(BaseModel):
    patient_id: str
    doctor_id: Optional[str] = None
    name: str
    name_ar: Optional[str] = None
    dosage: str
    frequency: str
    frequency_ar: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None

class MedicationCreate(MedicationBase):
    pass

class Medication(MedicationBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Medical Image Model (X-ray, ECG, Lab tests)
class MedicalImageBase(BaseModel):
    patient_id: str
    image_type: ImageType
    title: str
    title_ar: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    image_base64: str
    ai_analysis: Optional[str] = None
    ai_suggestions: Optional[List[str]] = None

class MedicalImageCreate(MedicalImageBase):
    pass

class MedicalImage(MedicalImageBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    uploaded_by: Optional[str] = None

# Appointment Model
class AppointmentBase(BaseModel):
    patient_id: str
    doctor_id: str
    date: str
    time: str
    duration_minutes: int = 30
    reason: Optional[str] = None
    reason_ar: Optional[str] = None
    status: AppointmentStatus = AppointmentStatus.SCHEDULED
    notes: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    pass

class Appointment(AppointmentBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Invoice Model
class InvoiceItem(BaseModel):
    description: str
    description_ar: Optional[str] = None
    quantity: int = 1
    unit_price: float
    total: float

class InvoiceBase(BaseModel):
    patient_id: str
    items: List[InvoiceItem]
    subtotal: float
    discount: float = 0
    tax: float = 0
    total: float
    payment_status: PaymentStatus = PaymentStatus.PENDING
    paid_amount: float = 0
    notes: Optional[str] = None

class InvoiceCreate(InvoiceBase):
    pass

class Invoice(InvoiceBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str = Field(default_factory=lambda: f"INV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Visit Model (Medical Visit/Consultation)
class PrescriptionItem(BaseModel):
    medication_name: str
    dosage: str
    frequency: str
    duration: Optional[str] = None
    notes: Optional[str] = None

class PharmacyLineItem(BaseModel):
    """Item from clinic pharmacy to add to invoice (e.g. injection, supplies)."""
    description: str
    description_ar: Optional[str] = None
    quantity: int = 1
    unit_price: float = 0

class VisitBase(BaseModel):
    patient_id: str
    # Vital Signs
    temperature: Optional[float] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    heart_rate: Optional[int] = None
    oxygen_saturation: Optional[int] = None
    # Visit Details
    reason: str
    reason_ar: Optional[str] = None
    diagnosis: Optional[str] = None
    diagnosis_ar: Optional[str] = None
    diagnosis_codes: Optional[List[str]] = None
    notes: Optional[str] = None
    notes_ar: Optional[str] = None
    # Doctor-only notes (not shown to patient in portal)
    doctor_notes: Optional[str] = None
    # Pharmacy items from clinic to add to invoice (e.g. injection, supplies)
    pharmacy: Optional[List[PharmacyLineItem]] = None
    # Prescription
    prescription: Optional[List[PrescriptionItem]] = None
    # Attached Documents
    attached_images: Optional[List[str]] = None
    # Billing
    consultation_fee: float = 0
    additional_fees: float = 0
    total_amount: float = 0
    payment_status: PaymentStatus = PaymentStatus.PENDING
    paid_amount: float = 0

class VisitCreate(VisitBase):
    pass

class Visit(VisitBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    visit_number: str = Field(default_factory=lambda: f"V-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}")
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Patient Document (saved reports, prescriptions - visible to patient via portal)
class PatientDocumentCreate(BaseModel):
    type: str  # "report" | "prescription"
    title: str
    content: str  # HTML or plain text
    visit_id: Optional[str] = None

class PatientDocument(BaseModel):
    id: str
    patient_id: str
    company_id: Optional[str] = None
    type: str
    title: str
    content: str
    visit_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Expense Model
class ExpenseCategory(str, Enum):
    SALARY = "salary"
    RENT = "rent"
    UTILITIES = "utilities"
    SUPPLIES = "supplies"
    EQUIPMENT = "equipment"
    MAINTENANCE = "maintenance"
    OTHER = "other"

class ExpenseBase(BaseModel):
    category: ExpenseCategory
    amount: float
    description: str
    description_ar: Optional[str] = None
    date: str
    receipt_number: Optional[str] = None
    notes: Optional[str] = None

class ExpenseCreate(ExpenseBase):
    pass

class Expense(ExpenseBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# AI Analysis Models
class SymptomAnalysisRequest(BaseModel):
    symptoms: List[str]
    patient_id: Optional[str] = None
    additional_info: Optional[str] = None
    language: str = "ar"

class ImageAnalysisRequest(BaseModel):
    image_base64: str
    image_type: ImageType
    patient_id: Optional[str] = None
    notes: Optional[str] = None
    language: str = "ar"

class AIAnalysisResponse(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    analysis: str
    suggestions: List[str]
    confidence: Optional[float] = None
    warnings: Optional[List[str]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== DOCTOR REVIEWS & RATINGS ====================

class DoctorReviewBase(BaseModel):
    doctor_id: str
    patient_name: str
    rating: int = Field(ge=1, le=5)  # 1-5 stars
    comment: Optional[str] = None
    is_verified: bool = False  # تم التحقق من أن المريض زار الطبيب

class DoctorReview(DoctorReviewBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_visible: bool = True
    doctor_reply: Optional[str] = None
    doctor_reply_at: Optional[datetime] = None

# ==================== AUDIT LOG ====================

class AuditLogEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    company_id: Optional[str] = None
    action: str  # login, logout, create, update, delete, view
    resource_type: str  # patient, appointment, invoice, etc.
    resource_id: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== RATE LIMITING ====================

class RateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests = defaultdict(list)
    
    def is_allowed(self, key: str) -> bool:
        now = time.time()
        minute_ago = now - 60
        # Clean old requests
        self.requests[key] = [t for t in self.requests[key] if t > minute_ago]
        # Check limit
        if len(self.requests[key]) >= self.requests_per_minute:
            return False
        self.requests[key].append(now)
        return True

# Global rate limiters (API limit configurable via API_RATE_LIMIT_PER_MINUTE)
login_rate_limiter = RateLimiter(requests_per_minute=10)  # 10 login attempts per minute
api_rate_limiter = RateLimiter(requests_per_minute=app_settings.api_rate_limit_per_minute)

# Audit log helper
async def log_audit(
    action: str,
    resource_type: str,
    resource_id: str = None,
    user: dict = None,
    details: dict = None,
    request: Request = None
):
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user.get("id") if user else None,
        "user_email": user.get("email") if user else None,
        "user_role": user.get("role") if user else None,
        "company_id": user.get("company_id") if user else None,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "details": details,
        "ip_address": request.client.host if request else None,
        "user_agent": request.headers.get("user-agent") if request else None,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(entry)


async def create_notification(company_id: str, notif_type: str, title: str, body: str, link: Optional[str] = None):
    """Create an in-app notification for company staff (shown in notification bell)."""
    doc = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "type": notif_type,
        "title": title,
        "body": body,
        "link": link or "",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(doc)


# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict, token_version: int = 0) -> str:
    to_encode = data.copy()
    to_encode["token_version"] = token_version
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_mfa_temp_token(user_id: str) -> str:
    """Short-lived token (5 min) used after password check when MFA is required. Claim mfa_pending=1."""
    to_encode = {"user_id": user_id, "mfa_pending": 1}
    expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_mfa_setup_temp_token(user_id: str) -> str:
    """Short-lived token (10 min) for users who must set up MFA before first login. Claim mfa_setup_pending=1."""
    to_encode = {"user_id": user_id, "mfa_setup_pending": 1}
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_portal_token(patient_id: str, company_id: str) -> str:
    """JWT for patient portal access (short-lived)."""
    to_encode = {"role": "patient_portal", "patient_id": patient_id, "company_id": company_id}
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_portal_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Decode JWT and return portal context (patient_id, company_id) if role is patient_portal."""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("role") != "patient_portal":
            raise HTTPException(status_code=401, detail="Invalid portal token")
        return {"patient_id": payload["patient_id"], "company_id": payload["company_id"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Portal session expired")
    except (jwt.InvalidTokenError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        if not payload.get("mfa_setup_pending"):
            idle_key = _IDLE_CACHE_PREFIX + user_id
            idle_ttl = app_settings.session_idle_timeout_minutes * 60
            if get_cached(idle_key) is None:
                raise HTTPException(status_code=401, detail="Session expired due to inactivity. Please log in again.")
            set_cached(idle_key, "1", ttl_seconds=idle_ttl)
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("phone"):
            user["phone"] = decrypt_field(user["phone"])
        # Invalidate token if user's token_version was incremented (logout from all devices)
        current_version = user.get("token_version", 0)
        if payload.get("token_version", 0) != current_version:
            raise HTTPException(status_code=401, detail="Session invalidated. Please log in again.")
        # تطبيع الدور (لتجنب 403 بسبب مسافات أو فرق في الحقل)
        role = (user.get("role") or "").strip()
        user["role"] = role
        # إثراء المستخدم بالميزات والصلاحيات (للعرض في الواجهة وحماية المسارات)
        company_id = user.get("company_id")
        if company_id:
            company = await db.companies.find_one({"id": company_id}, {"_id": 0, "features": 1, "custom_permissions": 1})
            user["company_features"] = (company or {}).get("features") or {}
            user["allowed_features"] = _user_allowed_features(user, company)
        else:
            user["company_features"] = {}
            user["allowed_features"] = list(ALL_FEATURE_IDS) if role == "super_admin" else []
        # السوبر أدمن دائماً يملك كل الميزات (حتى لو له company_id أو شركة محذوفة)
        if role == "super_admin":
            user["allowed_features"] = list(ALL_FEATURE_IDS)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user_or_mfa_setup(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Accepts full access token or MFA-setup temp token (for /auth/mfa/setup and /auth/mfa/verify)."""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        if payload.get("mfa_setup_pending"):
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "email": 1, "role": 1})
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            return user
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("phone"):
            user["phone"] = decrypt_field(user["phone"])
        current_version = user.get("token_version", 0)
        if payload.get("token_version", 0) != current_version:
            raise HTTPException(status_code=401, detail="Session invalidated. Please log in again.")
        role = (user.get("role") or "").strip()
        user["role"] = role
        company_id = user.get("company_id")
        if company_id:
            company = await db.companies.find_one({"id": company_id}, {"_id": 0, "features": 1, "custom_permissions": 1})
            user["company_features"] = (company or {}).get("features") or {}
            user["allowed_features"] = _user_allowed_features(user, company)
        else:
            user["company_features"] = {}
            user["allowed_features"] = list(ALL_FEATURE_IDS) if role == "super_admin" else []
        if role == "super_admin":
            user["allowed_features"] = list(ALL_FEATURE_IDS)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_feature(feature_id: str):
    """اعتماد: يمنع الوصول إذا الميزة غير مفعلة للعيادة أو المستخدم لا يملك الصلاحية."""
    async def _check(current_user: dict = Depends(get_current_user)):
        allowed = current_user.get("allowed_features") or []
        if feature_id in allowed:
            return current_user
        raise HTTPException(
            status_code=403,
            detail="Feature not enabled for this clinic or you do not have permission."
        )
    return _check

# ==================== AUTH ROUTES (registered from routers.auth) ====================
from routers.auth import register_auth_routes
register_auth_routes(api_router)

# ==================== HEALTH & READINESS (routers/health.py) ====================
from routers.health import register_health_routes
register_health_routes(api_router)

# ==================== PATIENTS CRUD (routers/patients.py) ====================
from routers.patients import register_patients_routes
register_patients_routes(api_router)

# ==================== NOTIFICATIONS ====================

@api_router.get("/notifications/unread", tags=["Notifications"])
async def get_unread_notifications(current_user: dict = Depends(require_feature("notifications"))):
    company_id = current_user.get("company_id")
    if not company_id:
        return {"notifications": [], "unread_count": 0}
    cursor = db.notifications.find(
        {"company_id": company_id, "read": False},
        {"_id": 0}
    ).sort("created_at", -1).limit(50)
    notifications = await cursor.to_list(50)
    return {"notifications": notifications, "unread_count": len(notifications)}


@api_router.patch("/notifications/{notification_id}/read", tags=["Notifications"])
async def mark_notification_read(notification_id: str, current_user: dict = Depends(require_feature("notifications"))):
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    result = await db.notifications.update_one(
        {"id": notification_id, "company_id": company_id},
        {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Marked as read"}


@api_router.patch("/notifications/read-all", tags=["Notifications"])
async def mark_all_notifications_read(current_user: dict = Depends(require_feature("notifications"))):
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    await db.notifications.update_many(
        {"company_id": company_id, "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All marked as read"}


# ==================== USERS ROUTES ====================

@api_router.get("/users", response_model=List[User], tags=["Users"])
async def get_users(current_user: dict = Depends(get_current_user), role: Optional[str] = None):
    """List users. Only super_admin can list all; others get 403."""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Access denied")
    query = {}
    if role:
        query["role"] = role
    users = await db.users.find(query, {"_id": 0, "password": 0}).to_list(1000)
    return users

@api_router.get("/users/doctors", tags=["Users"])
async def get_doctors(current_user: dict = Depends(get_current_user)):
    """List doctors. Super_admin sees all; others see only doctors in their company."""
    query = {"role": "doctor"}
    if current_user.get("role") != "super_admin":
        company_id = current_user.get("company_id")
        if not company_id:
            return []
        query["company_id"] = company_id
    doctors = await db.users.find(query, {"_id": 0, "password": 0}).to_list(500)
    return doctors

class UserUpdate(BaseModel):
    name: Optional[str] = None
    name_ar: Optional[str] = None
    specialty: Optional[str] = None
    consultation_fee: Optional[int] = None
    phone: Optional[str] = None
    company_id: Optional[str] = None

@api_router.put("/users/{user_id}", tags=["Users"])
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    # Only super_admin can update users
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    updates = {}
    if user_data.name is not None:
        updates["name"] = user_data.name
    if user_data.name_ar is not None:
        updates["name_ar"] = user_data.name_ar
    if user_data.specialty is not None:
        updates["specialty"] = user_data.specialty
    if user_data.consultation_fee is not None:
        updates["consultation_fee"] = user_data.consultation_fee
    if user_data.phone is not None:
        updates["phone"] = user_data.phone
    if user_data.company_id is not None:
        updates["company_id"] = user_data.company_id
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return user

# ==================== PATIENTS CRUD: see routers/patients.py ====================

# ==================== ALLERGIES ROUTES ====================

@api_router.post("/allergies", response_model=Allergy, tags=["Patients"])
async def create_allergy(allergy_data: AllergyCreate, current_user: dict = Depends(get_current_user)):
    allergy_obj = Allergy(**allergy_data.model_dump())
    doc = allergy_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.allergies.insert_one(doc)
    return allergy_obj

@api_router.get("/allergies/patient/{patient_id}", response_model=List[Allergy], tags=["Patients"])
async def get_patient_allergies(patient_id: str, current_user: dict = Depends(get_current_user)):
    allergies = await db.allergies.find({"patient_id": patient_id}, {"_id": 0}).to_list(100)
    return allergies

@api_router.delete("/allergies/{allergy_id}", tags=["Patients"])
async def delete_allergy(allergy_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.allergies.delete_one({"id": allergy_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Allergy not found")
    return {"message": "Allergy deleted successfully"}

# ==================== DIAGNOSES ROUTES ====================

@api_router.post("/diagnoses", response_model=Diagnosis, tags=["Patients"])
async def create_diagnosis(diagnosis_data: DiagnosisCreate, current_user: dict = Depends(get_current_user)):
    diagnosis_obj = Diagnosis(**diagnosis_data.model_dump())
    doc = diagnosis_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.diagnoses.insert_one(doc)
    return diagnosis_obj

@api_router.get("/diagnoses/patient/{patient_id}", response_model=List[Diagnosis], tags=["Patients"])
async def get_patient_diagnoses(patient_id: str, current_user: dict = Depends(get_current_user)):
    diagnoses = await db.diagnoses.find({"patient_id": patient_id}, {"_id": 0}).to_list(100)
    return diagnoses

# ==================== MEDICATIONS ROUTES ====================

@api_router.post("/medications", response_model=Medication, tags=["Patients"])
async def create_medication(medication_data: MedicationCreate, current_user: dict = Depends(get_current_user)):
    medication_obj = Medication(**medication_data.model_dump())
    doc = medication_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.medications.insert_one(doc)
    return medication_obj

@api_router.get("/medications/patient/{patient_id}", response_model=List[Medication], tags=["Patients"])
async def get_patient_medications(patient_id: str, current_user: dict = Depends(get_current_user)):
    medications = await db.medications.find({"patient_id": patient_id}, {"_id": 0}).to_list(100)
    return medications

@api_router.delete("/medications/{medication_id}", tags=["Patients"])
async def delete_medication(medication_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.medications.delete_one({"id": medication_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medication not found")
    return {"message": "Medication deleted successfully"}

@api_router.delete("/diagnoses/{diagnosis_id}", tags=["Patients"])
async def delete_diagnosis(diagnosis_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.diagnoses.delete_one({"id": diagnosis_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    return {"message": "Diagnosis deleted successfully"}

# ==================== MEDICAL IMAGES ROUTES ====================

@api_router.post("/medical-images", response_model=MedicalImage, tags=["Patients"])
async def create_medical_image(image_data: MedicalImageCreate, current_user: dict = Depends(get_current_user)):
    image_obj = MedicalImage(**image_data.model_dump())
    image_obj.uploaded_by = current_user.get("id")
    doc = image_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.medical_images.insert_one(doc)
    return image_obj

@api_router.get("/medical-images/patient/{patient_id}", tags=["Patients"])
async def get_patient_medical_images(patient_id: str, current_user: dict = Depends(get_current_user)):
    images = await db.medical_images.find({"patient_id": patient_id}, {"_id": 0}).to_list(100)
    return images

@api_router.delete("/medical-images/{image_id}", tags=["Patients"])
async def delete_medical_image(image_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.medical_images.delete_one({"id": image_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medical image not found")
    return {"message": "Medical image deleted successfully"}

# ==================== APPOINTMENTS ROUTES ====================

@api_router.post("/appointments", response_model=Appointment, tags=["Appointments"])
async def create_appointment(appointment_data: AppointmentCreate, request: Request, current_user: dict = Depends(require_feature("appointments"))):
    company_id = current_user.get("company_id")
    appointment_obj = Appointment(**appointment_data.model_dump())
    doc = appointment_obj.model_dump()
    doc["company_id"] = company_id  # Data isolation
    doc["created_at"] = doc["created_at"].isoformat()
    await db.appointments.insert_one(doc)
    await log_audit("create", "appointment", resource_id=appointment_obj.id, user=current_user, request=request)
    return appointment_obj

@api_router.get("/appointments", response_model=List[Appointment], tags=["Appointments"])
async def get_appointments(
    current_user: dict = Depends(require_feature("appointments")),
    date: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    doctor_id: Optional[str] = None,
    status: Optional[str] = None
):
    company_id = current_user.get("company_id")
    query = {}
    
    # Data isolation
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    
    if date:
        query["date"] = date
    elif date_from and date_to:
        query["date"] = {"$gte": date_from, "$lte": date_to}
    if doctor_id:
        query["doctor_id"] = doctor_id
    if status:
        query["status"] = status
    appointments = await db.appointments.find(query, {"_id": 0}).to_list(1000)
    return appointments

@api_router.get("/appointments/{appointment_id}", response_model=Appointment, tags=["Appointments"])
async def get_appointment(appointment_id: str, current_user: dict = Depends(require_feature("appointments"))):
    company_id = current_user.get("company_id")
    query = {"id": appointment_id}
    
    # Data isolation
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    
    appointment = await db.appointments.find_one(query, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment

@api_router.put("/appointments/{appointment_id}", response_model=Appointment, tags=["Appointments"])
async def update_appointment(appointment_id: str, appointment_data: AppointmentCreate, request: Request, current_user: dict = Depends(require_feature("appointments"))):
    company_id = current_user.get("company_id")
    query = {"id": appointment_id}
    
    # Data isolation
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    
    appointment = await db.appointments.find_one(query)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    await db.appointments.update_one(query, {"$set": appointment_data.model_dump()})
    await log_audit("update", "appointment", resource_id=appointment_id, user=current_user, request=request)
    updated = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    return updated

# Queue / Waiting room: get today's queue and update queue status
@api_router.get("/queue/today", tags=["Appointments"])
async def get_queue_today(current_user: dict = Depends(require_feature("queue")), doctor_id: Optional[str] = None):
    """Today's appointments as queue (waiting, in_consultation, completed)."""
    company_id = current_user.get("company_id")
    from datetime import date
    today = date.today().isoformat()
    query = {"company_id": company_id, "date": today, "status": {"$ne": "cancelled"}}
    if current_user.get("role") != "super_admin":
        query["company_id"] = company_id
    if doctor_id:
        query["doctor_id"] = doctor_id
    appointments = await db.appointments.find(query, {"_id": 0}).sort("time", 1).to_list(200)
    patients = {}
    for a in appointments:
        pid = a.get("patient_id")
        if pid and pid not in patients:
            p = await db.patients.find_one({"id": pid}, {"_id": 0, "name": 1, "name_ar": 1})
            if p:
                patients[pid] = p.get("name_ar") or p.get("name", "")
    for a in appointments:
        a["patient_name"] = patients.get(a.get("patient_id"), "")
        a.setdefault("queue_status", "scheduled")
        a["source"] = "appointment"
        pid = a.get("patient_id")
        if pid:
            last_visit = await db.visits.find_one({"patient_id": pid}, {"_id": 0, "reason": 1}, sort=[("created_at", -1)])
            a["visit_reason"] = last_visit.get("reason", "") if last_visit else ""
    walkin_query = {"company_id": company_id, "date": today}
    if doctor_id:
        walkin_query["$or"] = [{"doctor_id": doctor_id}, {"doctor_id": {"$in": [None, ""]}}]
    walkins = await db.queue_walkins.find(walkin_query, {"_id": 0}).sort("created_at", 1).to_list(100)
    for w in walkins:
        w["source"] = "walkin"
        pid = w.get("patient_id")
        if pid and pid not in patients:
            p = await db.patients.find_one({"id": pid}, {"_id": 0, "name": 1, "name_ar": 1})
            if p:
                patients[pid] = p.get("name_ar") or p.get("name", "")
        w["patient_name"] = patients.get(pid, "")
        w["time"] = w.get("time", "-")
        w["visit_reason"] = w.get("reason", "")
    combined = list(appointments) + list(walkins)
    combined.sort(key=lambda x: (x.get("time") or "", x.get("created_at") or ""))
    return {"items": combined}


class QueueStatusUpdate(BaseModel):
    queue_status: str  # scheduled | waiting | in_consultation | completed


class QueueAddWalkin(BaseModel):
    patient_id: str
    doctor_id: Optional[str] = None
    reason: Optional[str] = None


@api_router.post("/queue/add", tags=["Appointments"])
async def queue_add_walkin(body: QueueAddWalkin, current_user: dict = Depends(require_feature("queue"))):
    """Add a patient to today's queue (walk-in, no appointment)."""
    company_id = current_user.get("company_id")
    from datetime import date
    today = date.today().isoformat()
    patient = await db.patients.find_one({"id": body.patient_id}, {"company_id": 1})
    if not patient or (current_user.get("role") != "super_admin" and patient.get("company_id") != company_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    doc = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "patient_id": body.patient_id,
        "doctor_id": body.doctor_id,
        "date": today,
        "time": datetime.now(timezone.utc).strftime("%H:%M"),
        "queue_status": "waiting",
        "reason": body.reason or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.queue_walkins.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.patch("/appointments/{appointment_id}/queue-status", tags=["Appointments"])
async def update_appointment_queue_status(appointment_id: str, body: QueueStatusUpdate, current_user: dict = Depends(require_feature("queue"))):
    company_id = current_user.get("company_id")
    if body.queue_status not in ("scheduled", "waiting", "in_consultation", "completed"):
        raise HTTPException(status_code=400, detail="Invalid queue_status")
    query = {"id": appointment_id}
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    result = await db.appointments.update_one(query, {"$set": {"queue_status": body.queue_status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"queue_status": body.queue_status}


@api_router.patch("/queue/walkin/{walkin_id}/queue-status", tags=["Appointments"])
async def update_walkin_queue_status(walkin_id: str, body: QueueStatusUpdate, current_user: dict = Depends(require_feature("queue"))):
    company_id = current_user.get("company_id")
    if body.queue_status not in ("scheduled", "waiting", "in_consultation", "completed"):
        raise HTTPException(status_code=400, detail="Invalid queue_status")
    query = {"id": walkin_id}
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    result = await db.queue_walkins.update_one(query, {"$set": {"queue_status": body.queue_status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Walk-in not found")
    return {"queue_status": body.queue_status}


@api_router.delete("/appointments/{appointment_id}", tags=["Appointments"])
async def delete_appointment(appointment_id: str, request: Request, current_user: dict = Depends(require_feature("appointments"))):
    company_id = current_user.get("company_id")
    query = {"id": appointment_id}
    
    # Data isolation
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    
    result = await db.appointments.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    await log_audit("delete", "appointment", resource_id=appointment_id, user=current_user, request=request)
    return {"message": "Appointment deleted successfully"}


# ==================== TELEMEDICINE (VIDEO CONSULTATIONS) ====================

class TelemedicineSessionCreate(BaseModel):
    patient_id: str
    doctor_id: str
    appointment_id: Optional[str] = None


class TelemedicineSessionEnd(BaseModel):
    prescription: Optional[List[dict]] = None  # [{ medication_name, dosage, frequency }]
    payment_collected: bool = False
    notes: Optional[str] = None


@api_router.post("/telemedicine/sessions", tags=["Appointments"])
async def create_telemedicine_session(body: TelemedicineSessionCreate, current_user: dict = Depends(get_current_user)):
    """Create a telemedicine session; returns room_id and join URL."""
    company_id = current_user.get("company_id")
    patient = await db.patients.find_one({"id": body.patient_id}, {"company_id": 1})
    if not patient or (current_user.get("role") != "super_admin" and patient.get("company_id") != company_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    doctor = await db.users.find_one({"id": body.doctor_id, "role": "doctor"}, {"_id": 0})
    if not doctor or (current_user.get("role") != "super_admin" and doctor.get("company_id") != company_id):
        raise HTTPException(status_code=404, detail="Doctor not found")
    room_id = str(uuid.uuid4()).replace("-", "")[:12]
    doc = {
        "id": str(uuid.uuid4()),
        "room_id": room_id,
        "patient_id": body.patient_id,
        "doctor_id": body.doctor_id,
        "company_id": company_id,
        "appointment_id": body.appointment_id,
        "status": "scheduled",
        "started_at": None,
        "ended_at": None,
        "prescription": None,
        "payment_collected": False,
        "notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.telemedicine_sessions.insert_one(doc)
    base_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    join_url = f"{base_url}/telemedicine/room/{room_id}"
    doc.pop("_id", None)
    return {"session": doc, "room_id": room_id, "join_url": join_url}


@api_router.get("/telemedicine/sessions/{room_id}", tags=["Appointments"])
async def get_telemedicine_session(room_id: str, current_user: dict = Depends(get_current_user)):
    session = await db.telemedicine_sessions.find_one({"room_id": room_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if current_user.get("role") != "super_admin" and session.get("company_id") != current_user.get("company_id"):
        raise HTTPException(status_code=403, detail="Access denied")
    return session


@api_router.patch("/telemedicine/sessions/{room_id}/start", tags=["Appointments"])
async def start_telemedicine_session(room_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.telemedicine_sessions.update_one(
        {"room_id": room_id, "company_id": current_user.get("company_id")},
        {"$set": {"status": "live", "started_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "live"}


@api_router.patch("/telemedicine/sessions/{room_id}/end", tags=["Appointments"])
async def end_telemedicine_session(room_id: str, body: TelemedicineSessionEnd, current_user: dict = Depends(get_current_user)):
    session = await db.telemedicine_sessions.find_one({"room_id": room_id})
    if not session or (current_user.get("role") != "super_admin" and session.get("company_id") != current_user.get("company_id")):
        raise HTTPException(status_code=404, detail="Session not found")
    update = {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}
    if body.prescription is not None:
        update["prescription"] = body.prescription
    if body.notes is not None:
        update["notes"] = body.notes
    update["payment_collected"] = body.payment_collected
    await db.telemedicine_sessions.update_one({"room_id": room_id}, {"$set": update})
    if body.prescription and session.get("patient_id"):
        visit_doc = {
            "id": str(uuid.uuid4()),
            "patient_id": session["patient_id"],
            "company_id": session["company_id"],
            "reason": "استشارة تليطب / Telemedicine consultation",
            "diagnosis": body.notes or "استشارة فيديو",
            "prescription": body.prescription,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.visits.insert_one(visit_doc)
    return {"status": "ended"}


# ==================== CONSENT FORMS & E-SIGNATURES ====================

class ConsentFormBase(BaseModel):
    title_ar: str
    title_en: Optional[str] = None
    body_ar: str
    body_en: Optional[str] = None


class ConsentForm(ConsentFormBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: Optional[str] = None


class ConsentSign(BaseModel):
    patient_id: str
    signature_name: str  # Full name as signed
    signature_data: Optional[str] = None  # Optional base64 image


@api_router.get("/consent-forms", tags=["Consent"])
async def list_consent_forms(current_user: dict = Depends(require_feature("consent"))):
    company_id = current_user.get("company_id")
    query = {}
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    items = await db.consent_forms.find(query, {"_id": 0}).to_list(100)
    return items


@api_router.post("/consent-forms", tags=["Consent"])
async def create_consent_form(body: ConsentFormBase, current_user: dict = Depends(require_feature("consent"))):
    company_id = current_user.get("company_id")
    doc = {"id": str(uuid.uuid4()), "company_id": company_id, **body.model_dump()}
    await db.consent_forms.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/patients/{patient_id}/consents", tags=["Consent"])
async def get_patient_consents(patient_id: str, current_user: dict = Depends(require_feature("consent"))):
    company_id = current_user.get("company_id")
    patient = await db.patients.find_one({"id": patient_id}, {"company_id": 1})
    if not patient or (current_user.get("role") != "super_admin" and patient.get("company_id") != company_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    signatures = await db.consent_signatures.find({"patient_id": patient_id}, {"_id": 0}).sort("signed_at", -1).to_list(50)
    for s in signatures:
        if isinstance(s.get("signed_at"), datetime):
            s["signed_at"] = s["signed_at"].isoformat()
    return signatures


@api_router.post("/consent-forms/{form_id}/sign", tags=["Consent"])
async def sign_consent(form_id: str, body: ConsentSign, request: Request, current_user: dict = Depends(require_feature("consent"))):
    company_id = current_user.get("company_id")
    form = await db.consent_forms.find_one({"id": form_id})
    if not form or (current_user.get("role") != "super_admin" and form.get("company_id") != company_id):
        raise HTTPException(status_code=404, detail="Form not found")
    patient = await db.patients.find_one({"id": body.patient_id}, {"company_id": 1})
    if not patient or (current_user.get("role") != "super_admin" and patient.get("company_id") != company_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    existing = await db.consent_signatures.find_one({"form_id": form_id, "patient_id": body.patient_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already signed")
    doc = {
        "id": str(uuid.uuid4()),
        "form_id": form_id,
        "patient_id": body.patient_id,
        "signature_name": body.signature_name,
        "signature_data": body.signature_data,
        "signed_at": datetime.now(timezone.utc).isoformat(),
        "signed_by_user_id": current_user.get("id"),
        "ip": request.client.host if request.client else None,
    }
    await db.consent_signatures.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ==================== PHARMACY / INVENTORY ====================

class InventoryItemBase(BaseModel):
    name_ar: str
    name_en: Optional[str] = None
    sku: Optional[str] = None
    quantity: float = 0
    unit: str = "unit"
    unit_price: float = 0  # سعر البيع للفاتورة
    expiry_date: Optional[str] = None
    reorder_level: float = 10


@api_router.get("/inventory", tags=["Inventory"])
async def list_inventory(current_user: dict = Depends(require_feature("pharmacy"))):
    company_id = current_user.get("company_id")
    query = {}
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    items = await db.inventory.find(query, {"_id": 0}).to_list(500)
    return items


@api_router.post("/inventory", tags=["Inventory"])
async def create_inventory_item(body: InventoryItemBase, current_user: dict = Depends(require_feature("pharmacy"))):
    company_id = current_user.get("company_id")
    doc = {"id": str(uuid.uuid4()), "company_id": company_id, **body.model_dump()}
    await db.inventory.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/inventory/{item_id}", tags=["Inventory"])
async def update_inventory_item(item_id: str, body: InventoryItemBase, current_user: dict = Depends(require_feature("pharmacy"))):
    company_id = current_user.get("company_id")
    query = {"id": item_id}
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    result = await db.inventory.update_one(query, {"$set": body.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return await db.inventory.find_one(query, {"_id": 0})


@api_router.delete("/inventory/{item_id}", tags=["Inventory"])
async def delete_inventory_item(item_id: str, current_user: dict = Depends(require_feature("pharmacy"))):
    company_id = current_user.get("company_id")
    query = {"id": item_id}
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    result = await db.inventory.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Deleted"}


@api_router.get("/inventory/alerts", tags=["Inventory"])
async def inventory_alerts(current_user: dict = Depends(require_feature("pharmacy"))):
    """Items at or below reorder level or expiring within 30 days."""
    company_id = current_user.get("company_id")
    query = {}
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    items = await db.inventory.find(query, {"_id": 0}).to_list(500)
    from datetime import datetime as dt, timedelta
    cutoff = (dt.now(timezone.utc) + timedelta(days=30)).date().isoformat()
    low = [i for i in items if (i.get("quantity") or 0) <= (i.get("reorder_level") or 0)]
    expiring = [i for i in items if i.get("expiry_date") and i.get("expiry_date") <= cutoff]
    return {"low_stock": low, "expiring_soon": expiring}


class PharmacyDispenseItem(BaseModel):
    inventory_id: str
    quantity: float


class PharmacyDispense(BaseModel):
    patient_id: str
    visit_id: Optional[str] = None
    items: List[PharmacyDispenseItem]


@api_router.post("/pharmacy/dispense", tags=["Inventory"])
async def pharmacy_dispense(body: PharmacyDispense, request: Request, current_user: dict = Depends(require_feature("pharmacy"))):
    """صرف أصناف من المخزون لمريض وإضافتها لفاتورته (أو فاتورة جديدة)."""
    company_id = current_user.get("company_id")
    patient = await db.patients.find_one({"id": body.patient_id}, {"company_id": 1})
    if not patient or (current_user.get("role") != "super_admin" and patient.get("company_id") != company_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    new_invoice_items = []
    for disp in body.items:
        inv = await db.inventory.find_one({"id": disp.inventory_id, "company_id": company_id})
        if not inv:
            raise HTTPException(status_code=404, detail=f"Inventory item {disp.inventory_id} not found")
        qty = inv.get("quantity") or 0
        if qty < disp.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {inv.get('name_ar') or inv.get('name_en')}")
        unit_price = inv.get("unit_price") or 0
        total = round(disp.quantity * unit_price, 2)
        new_invoice_items.append({
            "description": inv.get("name_en") or inv.get("name_ar", ""),
            "description_ar": inv.get("name_ar") or inv.get("name_en", ""),
            "quantity": int(disp.quantity) if disp.quantity == int(disp.quantity) else disp.quantity,
            "unit_price": unit_price,
            "total": total,
        })
        await db.inventory.update_one(
            {"id": disp.inventory_id},
            {"$inc": {"quantity": -disp.quantity}},
        )
    if not new_invoice_items:
        raise HTTPException(status_code=400, detail="No items to dispense")
    subtotal = sum(i["total"] for i in new_invoice_items)
    total = round(subtotal, 2)
    existing = await db.invoices.find_one(
        {"patient_id": body.patient_id, "company_id": company_id, "payment_status": "pending"},
        sort=[("created_at", -1)],
    )
    if existing:
        existing_items = list(existing.get("items") or [])
        existing_items.extend(new_invoice_items)
        new_subtotal = sum(it.get("total", 0) for it in existing_items)
        new_total = round(new_subtotal - (existing.get("discount") or 0) + (existing.get("tax") or 0), 2)
        await db.invoices.update_one(
            {"id": existing["id"]},
            {"$set": {"items": existing_items, "subtotal": new_subtotal, "total": new_total}},
        )
        await log_audit("update", "invoice", resource_id=existing["id"], user=current_user, details={"action": "add_items"}, request=request)
        return {"invoice_id": existing["id"], "added_items": new_invoice_items, "message": "تم إضافة الأصناف للفاتورة"}
    inv_id = str(uuid.uuid4())
    doc = {
        "id": inv_id,
        "invoice_number": f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
        "patient_id": body.patient_id,
        "company_id": company_id,
        "visit_id": body.visit_id,
        "items": new_invoice_items,
        "subtotal": subtotal,
        "discount": 0,
        "tax": 0,
        "total": total,
        "payment_status": "pending",
        "paid_amount": 0,
        "notes": "فاتورة كشف + صيدلية",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.invoices.insert_one(doc)
    return {"invoice_id": inv_id, "added_items": new_invoice_items, "message": "تم إنشاء فاتورة جديدة وإضافة الأصناف"}


# ==================== SMART MARKETING (SMS / CAMPAIGNS) ====================

class CampaignCreate(BaseModel):
    name: str
    message: str
    channel: str = "sms"  # sms | email
    segment: str = "all"  # all | has_phone


@api_router.post("/marketing/campaigns", tags=["Notifications"])
async def create_and_send_campaign(body: CampaignCreate, current_user: dict = Depends(require_feature("marketing"))):
    """Create a campaign and send to segment (SMS via Twilio if configured)."""
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Company required")
    settings = await db.notification_settings.find_one({"company_id": company_id})
    if not settings or not settings.get("twilio_account_sid") or not settings.get("twilio_auth_token"):
        raise HTTPException(status_code=400, detail="SMS not configured. Configure Twilio in notification settings.")
    from twilio.rest import Client
    client = Client(settings["twilio_account_sid"], decrypt_field(settings["twilio_auth_token"]))
    patients = await db.patients.find({"company_id": company_id}, {"_id": 0, "id": 1, "phone": 1}).to_list(5000)
    sent = 0
    for p in patients:
        phone = decrypt_field(p.get("phone")) or p.get("phone") or ""
        if not phone or len(phone) < 8:
            continue
        try:
            client.messages.create(body=body.message[:1600], from_=settings.get("twilio_phone_number"), to=phone)
            sent += 1
        except Exception as e:
            logger.warning(f"Campaign SMS to {phone}: {e}")
    doc = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "name": body.name,
        "message": body.message,
        "channel": body.channel,
        "segment": body.segment,
        "sent_count": sent,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.marketing_campaigns.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/marketing/campaigns", tags=["Notifications"])
async def list_campaigns(current_user: dict = Depends(require_feature("marketing"))):
    company_id = current_user.get("company_id")
    query = {}
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    items = await db.marketing_campaigns.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


# ==================== INVOICES ROUTES ====================

@api_router.post("/invoices", response_model=Invoice, tags=["Invoices"])
async def create_invoice(invoice_data: InvoiceCreate, request: Request, current_user: dict = Depends(require_feature("invoices"))):
    company_id = current_user.get("company_id")
    invoice_obj = Invoice(**invoice_data.model_dump())
    doc = invoice_obj.model_dump()
    doc["company_id"] = company_id  # Data isolation
    doc["created_at"] = doc["created_at"].isoformat()
    await db.invoices.insert_one(doc)
    await log_audit("create", "invoice", resource_id=invoice_obj.id, user=current_user, request=request)
    return invoice_obj

@api_router.get("/invoices", response_model=List[Invoice], tags=["Invoices"])
async def get_invoices(current_user: dict = Depends(require_feature("invoices")), patient_id: Optional[str] = None, status: Optional[str] = None):
    company_id = current_user.get("company_id")
    query = {}
    
    # Data isolation
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    
    if patient_id:
        query["patient_id"] = patient_id
    if status:
        query["payment_status"] = status
    invoices = await db.invoices.find(query, {"_id": 0}).to_list(1000)
    return invoices

@api_router.get("/invoices/{invoice_id}", response_model=Invoice, tags=["Invoices"])
async def get_invoice(invoice_id: str, current_user: dict = Depends(require_feature("invoices"))):
    company_id = current_user.get("company_id")
    query = {"id": invoice_id}
    
    # Data isolation
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    
    invoice = await db.invoices.find_one(query, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@api_router.post("/invoices/{invoice_id}/create-checkout-session", tags=["Invoices"])
async def create_invoice_checkout_session(invoice_id: str, current_user: dict = Depends(require_feature("invoices"))):
    """Create a Stripe Checkout Session for paying the invoice online. Returns { url } to redirect the user."""
    import stripe
    stripe_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe_key:
        raise HTTPException(status_code=503, detail="Online payment is not configured (STRIPE_SECRET_KEY missing)")
    stripe.api_key = stripe_key
    company_id = current_user.get("company_id")
    query = {"id": invoice_id}
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    invoice = await db.invoices.find_one(query, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    total = invoice.get("total", 0)
    paid = invoice.get("paid_amount", 0)
    amount_due = round(total - paid, 2)
    if amount_due <= 0:
        raise HTTPException(status_code=400, detail="Invoice is already fully paid")
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "sar",
                    "product_data": {
                        "name": f"Invoice #{invoice.get('invoice_number', invoice_id)}",
                        "description": f"Payment for invoice {invoice_id}",
                    },
                    "unit_amount": int(amount_due * 100),
                },
                "quantity": 1,
            }],
            success_url=f"{frontend_url}/billing?payment=success&invoice_id={invoice_id}",
            cancel_url=f"{frontend_url}/billing?payment=cancelled",
            metadata={"invoice_id": invoice_id, "company_id": invoice.get("company_id", "")},
        )
        return {"url": session.url}
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create payment session")


@api_router.put("/invoices/{invoice_id}/pay", tags=["Invoices"])
async def pay_invoice(invoice_id: str, amount: float, request: Request, current_user: dict = Depends(require_feature("invoices"))):
    company_id = current_user.get("company_id")
    query = {"id": invoice_id}
    
    # Data isolation
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    
    invoice = await db.invoices.find_one(query, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    new_paid = invoice.get("paid_amount", 0) + amount
    total = invoice["total"]
    
    if new_paid >= total:
        status = PaymentStatus.PAID
        new_paid = total
    else:
        status = PaymentStatus.PARTIAL
    
    await db.invoices.update_one(
        query,
        {"$set": {"paid_amount": new_paid, "payment_status": status}}
    )
    await log_audit("pay", "invoice", resource_id=invoice_id, user=current_user, details={"amount": amount, "new_paid": new_paid, "status": status}, request=request)
    if company_id:
        await create_notification(
            company_id,
            "invoice_paid",
            "تم تسجيل دفع / Payment recorded",
            f"تم تسجيل دفع {amount} للفاتورة #{invoice.get('invoice_number', invoice_id)}",
            link="/billing",
        )
    return {"message": "Payment recorded", "paid_amount": new_paid, "status": status}

# ==================== EXPENSES ROUTES ====================

@api_router.post("/expenses", response_model=Expense, tags=["Invoices"])
async def create_expense(expense_data: ExpenseCreate, request: Request, current_user: dict = Depends(require_feature("invoices"))):
    company_id = current_user.get("company_id")
    expense_obj = Expense(**expense_data.model_dump())
    doc = expense_obj.model_dump()
    doc["company_id"] = company_id  # Data isolation
    doc["created_at"] = doc["created_at"].isoformat()
    await db.expenses.insert_one(doc)
    await log_audit("create", "expense", resource_id=expense_obj.id, user=current_user, request=request)
    return expense_obj

@api_router.get("/expenses", response_model=List[Expense], tags=["Invoices"])
async def get_expenses(
    current_user: dict = Depends(require_feature("invoices")),
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    company_id = current_user.get("company_id")
    query = {}
    
    # Data isolation
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    
    if category:
        query["category"] = category
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    expenses = await db.expenses.find(query, {"_id": 0}).to_list(1000)
    return expenses

@api_router.delete("/expenses/{expense_id}", tags=["Invoices"])
async def delete_expense(expense_id: str, request: Request, current_user: dict = Depends(require_feature("invoices"))):
    company_id = current_user.get("company_id")
    query = {"id": expense_id}
    
    # Data isolation
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    
    result = await db.expenses.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    await log_audit("delete", "expense", resource_id=expense_id, user=current_user, request=request)
    return {"message": "Expense deleted successfully"}

# ==================== ACCOUNTING/REPORTS ROUTES ====================

@api_router.get("/accounting/summary", tags=["Invoices"])
async def get_accounting_summary(
    current_user: dict = Depends(require_feature("invoices")),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    # Get total income from invoices
    invoice_query = {"payment_status": {"$in": ["paid", "partial"]}}
    if start_date and end_date:
        invoice_query["created_at"] = {"$gte": start_date, "$lte": end_date}
    
    invoices = await db.invoices.find(invoice_query, {"_id": 0}).to_list(10000)
    total_income = sum(inv.get("paid_amount", 0) for inv in invoices)
    pending_income = sum(inv.get("total", 0) - inv.get("paid_amount", 0) for inv in invoices if inv.get("payment_status") != "paid")
    
    # Get total expenses
    expense_query = {}
    if start_date and end_date:
        expense_query["date"] = {"$gte": start_date, "$lte": end_date}
    
    expenses = await db.expenses.find(expense_query, {"_id": 0}).to_list(10000)
    total_expenses = sum(exp.get("amount", 0) for exp in expenses)
    
    # Expense breakdown by category
    expense_by_category = {}
    for exp in expenses:
        cat = exp.get("category", "other")
        expense_by_category[cat] = expense_by_category.get(cat, 0) + exp.get("amount", 0)
    
    return {
        "total_income": total_income,
        "pending_income": pending_income,
        "total_expenses": total_expenses,
        "net_profit": total_income - total_expenses,
        "expense_by_category": expense_by_category,
        "invoice_count": len(invoices),
        "expense_count": len(expenses)
    }

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats", tags=["Users"])
async def get_dashboard_stats(current_user: dict = Depends(require_feature("dashboard"))):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    company_id = current_user.get("company_id")
    
    # Build query with data isolation
    query = {}
    if current_user.get("role") != "super_admin" and company_id:
        query["company_id"] = company_id
    
    # Counts
    total_patients = await db.patients.count_documents(query)
    total_appointments = await db.appointments.count_documents(query)
    appt_query = {**query, "date": today}
    today_appointments = await db.appointments.count_documents(appt_query)
    invoice_query = {**query, "payment_status": {"$in": ["pending", "partial"]}}
    pending_invoices = await db.invoices.count_documents(invoice_query)
    
    # Recent patients
    recent_patients = await db.patients.find(query, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    # Today's appointments with patient info
    today_appts = await db.appointments.find(appt_query, {"_id": 0}).to_list(100)
    for appt in today_appts:
        patient = await db.patients.find_one({"id": appt["patient_id"]}, {"_id": 0, "name": 1, "name_ar": 1})
        if patient:
            appt["patient_name"] = patient.get("name")
            appt["patient_name_ar"] = patient.get("name_ar")
    
    return {
        "total_patients": total_patients,
        "total_appointments": total_appointments,
        "today_appointments": today_appointments,
        "pending_invoices": pending_invoices,
        "recent_patients": recent_patients,
        "today_appointments_list": today_appts
    }

# ==================== MEDICAL REFERENCE LISTS ====================

# Common allergies list (Arabic/English)
COMMON_ALLERGIES = [
    {"id": "penicillin", "name_ar": "البنسلين", "name_en": "Penicillin"},
    {"id": "aspirin", "name_ar": "الأسبرين", "name_en": "Aspirin"},
    {"id": "ibuprofen", "name_ar": "إيبوبروفين", "name_en": "Ibuprofen"},
    {"id": "sulfa", "name_ar": "أدوية السلفا", "name_en": "Sulfa Drugs"},
    {"id": "latex", "name_ar": "اللاتكس", "name_en": "Latex"},
    {"id": "peanuts", "name_ar": "الفول السوداني", "name_en": "Peanuts"},
    {"id": "tree_nuts", "name_ar": "المكسرات", "name_en": "Tree Nuts"},
    {"id": "milk", "name_ar": "الحليب ومشتقاته", "name_en": "Milk/Dairy"},
    {"id": "eggs", "name_ar": "البيض", "name_en": "Eggs"},
    {"id": "wheat", "name_ar": "القمح (الجلوتين)", "name_en": "Wheat/Gluten"},
    {"id": "soy", "name_ar": "الصويا", "name_en": "Soy"},
    {"id": "fish", "name_ar": "الأسماك", "name_en": "Fish"},
    {"id": "shellfish", "name_ar": "المحار والقشريات", "name_en": "Shellfish"},
    {"id": "bee_stings", "name_ar": "لسعات النحل", "name_en": "Bee Stings"},
    {"id": "dust_mites", "name_ar": "عث الغبار", "name_en": "Dust Mites"},
    {"id": "pollen", "name_ar": "حبوب اللقاح", "name_en": "Pollen"},
    {"id": "mold", "name_ar": "العفن", "name_en": "Mold"},
    {"id": "animal_dander", "name_ar": "وبر الحيوانات", "name_en": "Animal Dander"},
    {"id": "codeine", "name_ar": "الكودايين", "name_en": "Codeine"},
    {"id": "morphine", "name_ar": "المورفين", "name_en": "Morphine"},
    {"id": "contrast_dye", "name_ar": "صبغة التباين", "name_en": "Contrast Dye"},
    {"id": "local_anesthetics", "name_ar": "التخدير الموضعي", "name_en": "Local Anesthetics"},
    {"id": "nsaids", "name_ar": "مضادات الالتهاب", "name_en": "NSAIDs"},
    {"id": "antibiotics", "name_ar": "المضادات الحيوية", "name_en": "Antibiotics"},
]

# Common diagnoses (ICD-10 based, Arabic/English)
COMMON_DIAGNOSES = [
    {"id": "J06.9", "name_ar": "التهاب الجهاز التنفسي العلوي", "name_en": "Upper Respiratory Infection"},
    {"id": "J18.9", "name_ar": "التهاب رئوي", "name_en": "Pneumonia"},
    {"id": "J45", "name_ar": "الربو", "name_en": "Asthma"},
    {"id": "I10", "name_ar": "ارتفاع ضغط الدم", "name_en": "Hypertension"},
    {"id": "E11", "name_ar": "داء السكري النوع 2", "name_en": "Type 2 Diabetes"},
    {"id": "E10", "name_ar": "داء السكري النوع 1", "name_en": "Type 1 Diabetes"},
    {"id": "K29.7", "name_ar": "التهاب المعدة", "name_en": "Gastritis"},
    {"id": "K21.0", "name_ar": "ارتجاع المريء", "name_en": "GERD"},
    {"id": "N39.0", "name_ar": "التهاب المسالك البولية", "name_en": "Urinary Tract Infection"},
    {"id": "M54.5", "name_ar": "ألم أسفل الظهر", "name_en": "Low Back Pain"},
    {"id": "G43", "name_ar": "الصداع النصفي", "name_en": "Migraine"},
    {"id": "R51", "name_ar": "صداع", "name_en": "Headache"},
    {"id": "J00", "name_ar": "الزكام", "name_en": "Common Cold"},
    {"id": "J02.9", "name_ar": "التهاب البلعوم", "name_en": "Pharyngitis"},
    {"id": "J03.9", "name_ar": "التهاب اللوزتين", "name_en": "Tonsillitis"},
    {"id": "H66.9", "name_ar": "التهاب الأذن الوسطى", "name_en": "Otitis Media"},
    {"id": "L30.9", "name_ar": "التهاب الجلد", "name_en": "Dermatitis"},
    {"id": "B35", "name_ar": "الفطريات الجلدية", "name_en": "Dermatophytosis"},
    {"id": "K59.0", "name_ar": "الإمساك", "name_en": "Constipation"},
    {"id": "K52.9", "name_ar": "التهاب المعدة والأمعاء", "name_en": "Gastroenteritis"},
    {"id": "R10.4", "name_ar": "ألم البطن", "name_en": "Abdominal Pain"},
    {"id": "I25.1", "name_ar": "مرض الشريان التاجي", "name_en": "Coronary Artery Disease"},
    {"id": "I50.9", "name_ar": "قصور القلب", "name_en": "Heart Failure"},
    {"id": "E78.5", "name_ar": "ارتفاع الكوليسترول", "name_en": "Hyperlipidemia"},
    {"id": "E03.9", "name_ar": "قصور الغدة الدرقية", "name_en": "Hypothyroidism"},
    {"id": "E05.9", "name_ar": "فرط نشاط الغدة الدرقية", "name_en": "Hyperthyroidism"},
    {"id": "D50.9", "name_ar": "فقر الدم", "name_en": "Anemia"},
    {"id": "F32.9", "name_ar": "الاكتئاب", "name_en": "Depression"},
    {"id": "F41.1", "name_ar": "اضطراب القلق", "name_en": "Anxiety Disorder"},
    {"id": "M79.3", "name_ar": "التهاب الأعصاب", "name_en": "Neuritis"},
    {"id": "G40", "name_ar": "الصرع", "name_en": "Epilepsy"},
    {"id": "N18.9", "name_ar": "مرض الكلى المزمن", "name_en": "Chronic Kidney Disease"},
    {"id": "K74.6", "name_ar": "تليف الكبد", "name_en": "Liver Cirrhosis"},
    {"id": "J44.9", "name_ar": "مرض الانسداد الرئوي المزمن", "name_en": "COPD"},
    {"id": "M06.9", "name_ar": "التهاب المفاصل الروماتويدي", "name_en": "Rheumatoid Arthritis"},
    {"id": "M15.9", "name_ar": "الفصال العظمي", "name_en": "Osteoarthritis"},
]

# Common medications list
COMMON_MEDICATIONS = [
    {"id": "paracetamol", "name_ar": "باراسيتامول", "name_en": "Paracetamol", "dosages": ["500mg", "1000mg"]},
    {"id": "ibuprofen", "name_ar": "إيبوبروفين", "name_en": "Ibuprofen", "dosages": ["200mg", "400mg", "600mg"]},
    {"id": "amoxicillin", "name_ar": "أموكسيسيلين", "name_en": "Amoxicillin", "dosages": ["250mg", "500mg", "1g"]},
    {"id": "azithromycin", "name_ar": "أزيثرومايسين", "name_en": "Azithromycin", "dosages": ["250mg", "500mg"]},
    {"id": "metformin", "name_ar": "ميتفورمين", "name_en": "Metformin", "dosages": ["500mg", "850mg", "1000mg"]},
    {"id": "omeprazole", "name_ar": "أوميبرازول", "name_en": "Omeprazole", "dosages": ["20mg", "40mg"]},
    {"id": "amlodipine", "name_ar": "أملوديبين", "name_en": "Amlodipine", "dosages": ["5mg", "10mg"]},
    {"id": "atorvastatin", "name_ar": "أتورفاستاتين", "name_en": "Atorvastatin", "dosages": ["10mg", "20mg", "40mg"]},
    {"id": "metoprolol", "name_ar": "ميتوبرولول", "name_en": "Metoprolol", "dosages": ["25mg", "50mg", "100mg"]},
    {"id": "losartan", "name_ar": "لوسارتان", "name_en": "Losartan", "dosages": ["25mg", "50mg", "100mg"]},
    {"id": "aspirin", "name_ar": "أسبرين", "name_en": "Aspirin", "dosages": ["81mg", "100mg", "325mg"]},
    {"id": "clopidogrel", "name_ar": "كلوبيدوجريل", "name_en": "Clopidogrel", "dosages": ["75mg"]},
    {"id": "levothyroxine", "name_ar": "ليفوثيروكسين", "name_en": "Levothyroxine", "dosages": ["25mcg", "50mcg", "100mcg"]},
    {"id": "salbutamol", "name_ar": "سالبوتامول", "name_en": "Salbutamol", "dosages": ["100mcg inhaler", "2mg", "4mg"]},
    {"id": "prednisolone", "name_ar": "بريدنيزولون", "name_en": "Prednisolone", "dosages": ["5mg", "20mg", "40mg"]},
    {"id": "cetirizine", "name_ar": "سيتيريزين", "name_en": "Cetirizine", "dosages": ["10mg"]},
    {"id": "loratadine", "name_ar": "لوراتادين", "name_en": "Loratadine", "dosages": ["10mg"]},
    {"id": "ranitidine", "name_ar": "رانيتيدين", "name_en": "Ranitidine", "dosages": ["150mg", "300mg"]},
    {"id": "metronidazole", "name_ar": "ميترونيدازول", "name_en": "Metronidazole", "dosages": ["250mg", "500mg"]},
    {"id": "ciprofloxacin", "name_ar": "سيبروفلوكساسين", "name_en": "Ciprofloxacin", "dosages": ["250mg", "500mg", "750mg"]},
    {"id": "diclofenac", "name_ar": "ديكلوفيناك", "name_en": "Diclofenac", "dosages": ["25mg", "50mg", "75mg"]},
    {"id": "tramadol", "name_ar": "ترامادول", "name_en": "Tramadol", "dosages": ["50mg", "100mg"]},
    {"id": "gabapentin", "name_ar": "جابابنتين", "name_en": "Gabapentin", "dosages": ["100mg", "300mg", "400mg"]},
    {"id": "sertraline", "name_ar": "سيرترالين", "name_en": "Sertraline", "dosages": ["25mg", "50mg", "100mg"]},
    {"id": "escitalopram", "name_ar": "إسيتالوبرام", "name_en": "Escitalopram", "dosages": ["5mg", "10mg", "20mg"]},
]

@api_router.get("/reference/allergies", tags=["Patients"])
async def get_common_allergies():
    """Get list of common allergies"""
    # Get custom allergies from database
    custom_allergies = await db.custom_allergies.find({}, {"_id": 0}).to_list(1000)
    return {"common": COMMON_ALLERGIES, "custom": custom_allergies}

@api_router.post("/reference/allergies", tags=["Patients"])
async def add_custom_allergy(data: dict, current_user: dict = Depends(get_current_user)):
    """Add a custom allergy to the database"""
    allergy = {
        "id": str(uuid.uuid4()),
        "name_ar": data.get("name_ar", ""),
        "name_en": data.get("name_en", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.custom_allergies.insert_one(allergy)
    return allergy

@api_router.get("/reference/diagnoses", tags=["Patients"])
async def get_common_diagnoses():
    """Get list of common diagnoses (ICD-10)"""
    custom_diagnoses = await db.custom_diagnoses.find({}, {"_id": 0}).to_list(1000)
    return {"common": COMMON_DIAGNOSES, "custom": custom_diagnoses}

@api_router.post("/reference/diagnoses", tags=["Patients"])
async def add_custom_diagnosis(data: dict, current_user: dict = Depends(get_current_user)):
    """Add a custom diagnosis to the database"""
    diagnosis = {
        "id": data.get("id", str(uuid.uuid4())),
        "name_ar": data.get("name_ar", ""),
        "name_en": data.get("name_en", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.custom_diagnoses.insert_one(diagnosis)
    return diagnosis

@api_router.get("/reference/medications", tags=["Patients"])
async def get_common_medications():
    """Get list of common medications"""
    custom_medications = await db.custom_medications.find({}, {"_id": 0}).to_list(1000)
    return {"common": COMMON_MEDICATIONS, "custom": custom_medications}

@api_router.post("/reference/medications", tags=["Patients"])
async def add_custom_medication(data: dict, current_user: dict = Depends(get_current_user)):
    """Add a custom medication to the database"""
    medication = {
        "id": str(uuid.uuid4()),
        "name_ar": data.get("name_ar", ""),
        "name_en": data.get("name_en", ""),
        "dosages": data.get("dosages", []),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.custom_medications.insert_one(medication)
    return medication

# ==================== PATIENT INVOICES ====================

@api_router.get("/patients/{patient_id}/invoices", tags=["Invoices"])
async def get_patient_invoices(patient_id: str, current_user: dict = Depends(get_current_user)):
    """Get all invoices for a patient with payment status"""
    invoices = await db.invoices.find({"patient_id": patient_id}, {"_id": 0}).to_list(100)
    
    total_amount = sum(inv.get("total", 0) for inv in invoices)
    total_paid = sum(inv.get("paid_amount", 0) for inv in invoices)
    total_pending = total_amount - total_paid
    
    return {
        "invoices": invoices,
        "summary": {
            "total_amount": total_amount,
            "total_paid": total_paid,
            "total_pending": total_pending,
            "has_pending": total_pending > 0
        }
    }

# ==================== VISITS (CONSULTATIONS) ====================

@api_router.post("/visits", tags=["Patients"])
async def create_visit(visit: VisitCreate, current_user: dict = Depends(get_current_user)):
    """Create a new medical visit/consultation"""
    visit_dict = visit.model_dump()
    visit_dict["id"] = str(uuid.uuid4())
    visit_dict["visit_number"] = f"V-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
    visit_dict["doctor_id"] = current_user.get("id")
    visit_dict["doctor_name"] = current_user.get("name", "Doctor")
    visit_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    # Update patient's latest vitals
    patient_update = {}
    if visit.temperature:
        patient_update["temperature"] = visit.temperature
    if visit.blood_pressure_systolic:
        patient_update["blood_pressure_systolic"] = visit.blood_pressure_systolic
    if visit.blood_pressure_diastolic:
        patient_update["blood_pressure_diastolic"] = visit.blood_pressure_diastolic
    if visit.heart_rate:
        patient_update["heart_rate"] = visit.heart_rate
    if visit.oxygen_saturation:
        patient_update["oxygen_saturation"] = visit.oxygen_saturation
    
    if patient_update:
        patient_update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.patients.update_one({"id": visit.patient_id}, {"$set": patient_update})
    
    # Create invoice if there's a fee or pharmacy items
    invoice_items = []
    if visit.consultation_fee > 0:
        invoice_items.append({"description": "Consultation Fee", "description_ar": "رسوم الاستشارة", "quantity": 1, "unit_price": visit.consultation_fee, "total": visit.consultation_fee})
    if visit.additional_fees > 0:
        invoice_items.append({"description": "Additional Fees", "description_ar": "رسوم إضافية", "quantity": 1, "unit_price": visit.additional_fees, "total": visit.additional_fees})
    if visit.pharmacy:
        for item in visit.pharmacy:
            total_item = item.quantity * item.unit_price
            invoice_items.append({
                "description": item.description,
                "description_ar": item.description_ar or item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total": total_item
            })
    invoice_total = sum(i["total"] for i in invoice_items)
    if invoice_total > 0:
        invoice = {
            "id": str(uuid.uuid4()),
            "invoice_number": f"INV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
            "patient_id": visit.patient_id,
            "visit_id": visit_dict["id"],
            "items": invoice_items,
            "subtotal": invoice_total,
            "discount": 0,
            "tax": 0,
            "total": invoice_total,
            "payment_status": visit.payment_status,
            "paid_amount": visit.paid_amount,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.invoices.insert_one(invoice)
    
    await db.visits.insert_one(visit_dict)
    # Return without MongoDB's _id
    visit_dict.pop("_id", None)
    return visit_dict

@api_router.get("/visits", tags=["Patients"])
async def get_visits(patient_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all visits, optionally filtered by patient"""
    query = {"patient_id": patient_id} if patient_id else {}
    visits = await db.visits.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return visits

@api_router.get("/visits/{visit_id}", tags=["Patients"])
async def get_visit(visit_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific visit"""
    visit = await db.visits.find_one({"id": visit_id}, {"_id": 0})
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    return visit

@api_router.get("/patients/{patient_id}/visits", tags=["Patients"])
async def get_patient_visits(patient_id: str, current_user: dict = Depends(get_current_user)):
    """Get all visits for a patient"""
    visits = await db.visits.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return visits

@api_router.get("/patients/{patient_id}/last-visit", tags=["Patients"])
async def get_patient_last_visit(patient_id: str, current_user: dict = Depends(get_current_user)):
    """Get the last visit for a patient"""
    visit = await db.visits.find_one({"patient_id": patient_id}, {"_id": 0}, sort=[("created_at", -1)])
    return visit

# ==================== PATIENT DOCUMENTS (reports, prescriptions - visible in portal) ====================

@api_router.post("/patients/{patient_id}/documents", tags=["Patients"])
async def create_patient_document(patient_id: str, body: PatientDocumentCreate, request: Request, current_user: dict = Depends(get_current_user)):
    """Save a document (report or prescription) for a patient. Patient can view via portal."""
    company_id = current_user.get("company_id")
    doc = {
        "id": str(uuid.uuid4()),
        "patient_id": patient_id,
        "company_id": company_id,
        "type": body.type,
        "title": body.title,
        "content": body.content,
        "visit_id": body.visit_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.patient_documents.insert_one(doc)
    await log_audit("create", "patient_document", resource_id=doc["id"], user=current_user, request=request)
    doc.pop("_id", None)
    return doc

@api_router.get("/patients/{patient_id}/documents", tags=["Patients"])
async def get_patient_documents(patient_id: str, current_user: dict = Depends(get_current_user)):
    """List documents for a patient (clinic view)."""
    docs = await db.patient_documents.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for d in docs:
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()
    return docs

@api_router.get("/portal/documents", tags=["Portal"])
async def portal_get_documents(portal_user: dict = Depends(get_portal_user)):
    """Portal: list documents the patient can see (reports, prescriptions)."""
    docs = await db.patient_documents.find(
        {"patient_id": portal_user["patient_id"], "company_id": portal_user["company_id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)
    for d in docs:
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()
    return {"documents": docs}

# ==================== AI ANALYSIS ROUTES ====================

# Unified error when OpenAI is not configured (EN + AR)
AI_NOT_CONFIGURED_DETAIL = (
    "AI service not configured (خدمة الذكاء الاصطناعي غير مضبوطة). "
    "Copy backend/.env.example to backend/.env, set OPENAI_API_KEY to your OpenAI API key, then restart the backend."
)


async def _get_ai_config(company_id: Optional[str] = None) -> tuple:
    """Return (provider, api_key). provider is 'openai' or 'gemini'. Uses company settings or env (OPENAI_API_KEY / GEMINI_API_KEY)."""
    provider = "openai"
    api_key = None
    if company_id:
        settings = await db.notification_settings.find_one({"company_id": company_id})
        if settings and settings.get("openai_api_key"):
            api_key = decrypt_field(settings["openai_api_key"])
            provider = (settings.get("ai_provider") or "openai").strip().lower()
            if provider not in ("openai", "gemini"):
                provider = "openai"
    if not api_key:
        api_key = os.environ.get("OPENAI_API_KEY")
        provider = "openai"
    if not api_key and os.environ.get("GEMINI_API_KEY"):
        api_key = os.environ.get("GEMINI_API_KEY")
        provider = "gemini"
    if not api_key:
        raise HTTPException(status_code=500, detail=AI_NOT_CONFIGURED_DETAIL)
    return (provider, api_key)


def _gemini_chat_sync(api_key: str, system_message: str, user_content: str, image_base64_list: Optional[List[str]] = None) -> str:
    """Sync Gemini call. Uses gemini-2.5-flash. Images supported via PIL."""
    import io
    import warnings
    from PIL import Image
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FutureWarning)
        import google.generativeai as genai
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")
    parts = [f"{system_message}\n\n{user_content}"]
    if image_base64_list:
        for b64 in image_base64_list:
            s = b64.split("base64,")[-1] if "base64," in b64 else b64
            img = Image.open(io.BytesIO(base64.b64decode(s)))
            parts.append(img)
    generation_config = genai.GenerationConfig(max_output_tokens=DEFAULT_MAX_OUTPUT_TOKENS)
    response = model.generate_content(parts, generation_config=generation_config)
    return (response.text or "").strip()


def _gemini_chat_messages_sync(api_key: str, messages: List[dict]) -> str:
    """Sync Gemini call with full message history (system + user/assistant turns)."""
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FutureWarning)
        import google.generativeai as genai
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")
    prompt_parts = []
    for m in messages:
        role = (m.get("role") or "user").lower()
        content = (m.get("content") or "")
        if isinstance(content, list):
            text = next((c.get("text", "") for c in content if c.get("type") == "text"), "")
            if text:
                prompt_parts.append(f"{role}: {text}")
        else:
            prompt_parts.append(f"{role}: {content}")
    prompt = "\n".join(prompt_parts)
    try:
        generation_config = genai.GenerationConfig(max_output_tokens=DEFAULT_MAX_OUTPUT_TOKENS)
        response = model.generate_content(prompt, generation_config=generation_config)
    except Exception:
        response = model.generate_content(prompt)
    return (response.text or "").strip()


async def _openai_chat(
    system_message: str,
    user_content: str,
    image_base64_list: Optional[List[str]] = None,
    company_id: Optional[str] = None,
) -> str:
    """Unified AI chat: uses OpenAI or Gemini based on company/env config."""
    provider, api_key = await _get_ai_config(company_id)
    if provider == "gemini":
        return await asyncio.to_thread(_gemini_chat_sync, api_key, system_message, user_content, image_base64_list)
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)
    messages: List[dict] = [{"role": "system", "content": system_message}]
    if image_base64_list:
        content: List[dict] = [{"type": "text", "text": user_content}]
        for b64 in image_base64_list:
            s = b64.split("base64,")[1] if "base64," in b64 else b64
            content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{s}"}})
        messages.append({"role": "user", "content": content})
    else:
        messages.append({"role": "user", "content": user_content})
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        max_tokens=DEFAULT_MAX_OUTPUT_TOKENS,
    )
    return response.choices[0].message.content or ""


def _parse_ai_json(response: str, default=None):
    """Extract JSON from LLM response (handles ```json ... ``` blocks). Returns parsed dict or default on failure."""
    if not response:
        return default
    json_str = response.strip()
    if "```json" in response:
        try:
            json_str = response.split("```json")[1].split("```")[0].strip()
        except IndexError:
            pass
    elif "```" in response:
        try:
            json_str = response.split("```")[1].split("```")[0].strip()
        except IndexError:
            pass
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return default


async def _openai_chat_messages(messages: List[dict], company_id: Optional[str] = None) -> str:
    """Unified AI chat with history: uses OpenAI or Gemini based on company/env config."""
    provider, api_key = await _get_ai_config(company_id)
    if provider == "gemini":
        return await asyncio.to_thread(_gemini_chat_messages_sync, api_key, messages)
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        max_tokens=DEFAULT_MAX_OUTPUT_TOKENS,
    )
    return response.choices[0].message.content or ""


@api_router.post("/ai/analyze-symptoms", response_model=AIAnalysisResponse, tags=["AI"])
async def analyze_symptoms(request: SymptomAnalysisRequest, req: Request, current_user: dict = Depends(require_feature("ai_analysis"))):
    await log_audit("ai_request", "ai", user=current_user, details={"endpoint": "analyze-symptoms"}, request=req)
    try:
        lang = request.language
        if lang == "ar":
            system_message = """أنت مساعد طبي ذكي متخصص في الأمراض الشائعة في منطقة الشرق الأوسط وسوريا.
            قم بتحليل الأعراض المقدمة واقترح التشخيصات المحتملة.
            تحذير: هذه اقتراحات فقط وليست تشخيصاً طبياً نهائياً. يجب استشارة طبيب متخصص.
            قدم الرد بصيغة JSON مع الحقول: analysis, suggestions (قائمة), warnings (قائمة)"""
        else:
            system_message = """You are an intelligent medical assistant specialized in common diseases in the Middle East and Syria region.
            Analyze the provided symptoms and suggest possible diagnoses.
            Warning: These are suggestions only, not a final medical diagnosis. Consult a specialized doctor.
            Provide response in JSON format with fields: analysis, suggestions (list), warnings (list)"""
        
        symptoms_text = ", ".join(request.symptoms)
        if request.additional_info:
            symptoms_text += f"\nAdditional info: {request.additional_info}"
        
        response = await _openai_chat(system_message, f"Symptoms: {symptoms_text}", company_id=current_user.get("company_id"))
        result = _parse_ai_json(response)
        if result is not None:
            return AIAnalysisResponse(
                analysis=result.get("analysis", response),
                suggestions=result.get("suggestions", []),
                warnings=result.get("warnings", [])
            )
        return AIAnalysisResponse(
            analysis=response,
            suggestions=[],
            warnings=["Could not parse structured response"]
        )
    except Exception as e:
        logger.error(f"AI analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

@api_router.post("/ai/analyze-image", response_model=AIAnalysisResponse, tags=["AI"])
async def analyze_medical_image(request: ImageAnalysisRequest, req: Request, current_user: dict = Depends(require_feature("ai_analysis"))):
    await log_audit("ai_request", "ai", user=current_user, details={"endpoint": "analyze-image"}, request=req)
    try:
        image_type_labels = {
            "xray": ("X-ray", "صورة أشعة"),
            "ecg": ("ECG/EKG", "تخطيط قلب"),
            "lab_test": ("Lab Test Results", "نتائج تحاليل"),
            "other": ("Medical Image", "صورة طبية")
        }
        
        type_en, type_ar = image_type_labels.get(request.image_type, ("Medical Image", "صورة طبية"))
        lang = request.language
        
        if lang == "ar":
            system_message = f"""أنت طبيب خبير متخصص في تحليل الصور الطبية ({type_ar}).
            قم بتحليل الصورة المقدمة وقدم:
            1. وصف تفصيلي لما تراه
            2. النتائج المحتملة أو التشخيصات
            3. توصيات للخطوات التالية
            تحذير: هذا تحليل مساعد فقط وليس تشخيصاً نهائياً.
            قدم الرد بصيغة JSON مع: analysis, suggestions, warnings"""
        else:
            system_message = f"""You are an expert physician specialized in analyzing medical images ({type_en}).
            Analyze the provided image and provide:
            1. Detailed description of what you see
            2. Possible findings or diagnoses
            3. Recommendations for next steps
            Warning: This is an assistive analysis only, not a final diagnosis.
            Provide response in JSON format with: analysis, suggestions, warnings"""
        
        image_data = request.image_base64
        prompt = f"Please analyze this {type_en} image."
        if request.notes:
            prompt += f"\nAdditional notes: {request.notes}"
        
        response = await _openai_chat(system_message, prompt, image_base64_list=[image_data], company_id=current_user.get("company_id"))
        result = _parse_ai_json(response)
        if result is not None:
            return AIAnalysisResponse(
                analysis=result.get("analysis", response),
                suggestions=result.get("suggestions", []),
                warnings=result.get("warnings", [])
            )
        return AIAnalysisResponse(
            analysis=response,
            suggestions=[],
            warnings=["Could not parse structured response"]
        )
    except Exception as e:
        logger.error(f"Image analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {str(e)}")

# ==================== COMPREHENSIVE PATIENT AI ANALYSIS ====================

class PatientAIAnalysisRequest(BaseModel):
    patient_id: str
    include_images: bool = True
    language: str = "ar"

@api_router.post("/ai/analyze-patient", tags=["AI"])
async def analyze_patient_comprehensive(request: PatientAIAnalysisRequest, req: Request, current_user: dict = Depends(require_feature("ai_analysis"))):
    """Comprehensive AI analysis of patient data including medical history, visits, vitals, images, etc."""
    await log_audit("ai_request", "ai", user=current_user, details={"endpoint": "analyze-patient", "patient_id": request.patient_id}, request=req)
    try:
        # Fetch ALL patient data
        patient = await db.patients.find_one({"id": request.patient_id}, {"_id": 0})
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        patient = _decrypt_patient_phi(patient)
        
        allergies = await db.allergies.find({"patient_id": request.patient_id}, {"_id": 0}).to_list(100)
        diagnoses = await db.diagnoses.find({"patient_id": request.patient_id}, {"_id": 0}).to_list(100)
        medications = await db.medications.find({"patient_id": request.patient_id}, {"_id": 0}).to_list(100)
        medical_images = await db.medical_images.find({"patient_id": request.patient_id}, {"_id": 0}).to_list(50)
        visits = await db.visits.find({"patient_id": request.patient_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
        invoices = await db.invoices.find({"patient_id": request.patient_id}, {"_id": 0}).to_list(50)
        
        # Calculate age
        age_str = "غير محدد"
        if patient.get('date_of_birth'):
            try:
                from datetime import datetime
                dob = datetime.strptime(patient.get('date_of_birth'), '%Y-%m-%d')
                today = datetime.now()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                age_str = f"{age} سنة"
            except Exception:
                age_str = patient.get('date_of_birth')
        
        # Calculate BMI
        bmi_str = "غير محدد"
        bmi_category = ""
        if patient.get('height_cm') and patient.get('weight_kg'):
            h = patient.get('height_cm')
            w = patient.get('weight_kg')
            bmi = w / ((h/100) ** 2)
            bmi_str = f"{bmi:.1f}"
            if bmi < 18.5:
                bmi_category = "نقص وزن"
            elif bmi < 25:
                bmi_category = "طبيعي"
            elif bmi < 30:
                bmi_category = "زيادة وزن"
            else:
                bmi_category = "سمنة"
        
        # Get latest vitals
        latest_vitals = ""
        if visits:
            v = visits[0]
            vitals_parts = []
            if v.get('temperature'):
                vitals_parts.append(f"الحرارة: {v.get('temperature')}°C")
            if v.get('blood_pressure_systolic') and v.get('blood_pressure_diastolic'):
                vitals_parts.append(f"الضغط: {v.get('blood_pressure_systolic')}/{v.get('blood_pressure_diastolic')}")
            if v.get('heart_rate'):
                vitals_parts.append(f"النبض: {v.get('heart_rate')}")
            if v.get('oxygen_saturation'):
                vitals_parts.append(f"الأكسجين: {v.get('oxygen_saturation')}%")
            if vitals_parts:
                latest_vitals = " | ".join(vitals_parts)
        
        # Build visit context: full detail for last 24 months, summary for older (so AI can "read" full history)
        visits_context_ar, _ = build_visits_context_with_summary(visits, max_recent_months=24, max_recent_count=50, lang_ar=True)
        visits_context_en, _ = build_visits_context_with_summary(visits, max_recent_months=24, max_recent_count=50, lang_ar=False)

        # Build comprehensive patient summary
        lang = request.language
        if lang == "ar":
            patient_summary = f"""
═══════════════════════════════════════════════════════════════
                    ملف المريض الطبي الشامل
═══════════════════════════════════════════════════════════════

【المعلومات الأساسية】
• الاسم: {patient.get('name_ar') or patient.get('name')}
• العمر: {age_str}
• الجنس: {'ذكر' if patient.get('gender') == 'male' else 'أنثى' if patient.get('gender') == 'female' else 'غير محدد'}
• فصيلة الدم: {patient.get('blood_type', 'غير محدد')}
• رقم الهوية: {patient.get('national_id', 'غير محدد')}
• الهاتف: {patient.get('phone', 'غير محدد')}

【القياسات الجسدية】
• الطول: {patient.get('height_cm', 'غير محدد')} سم
• الوزن: {patient.get('weight_kg', 'غير محدد')} كغ
• مؤشر كتلة الجسم (BMI): {bmi_str} ({bmi_category})
{'• حامل: نعم - الأسبوع ' + str(patient.get('pregnancy_weeks', '')) if patient.get('is_pregnant') else ''}

【آخر العلامات الحيوية】
{latest_vitals if latest_vitals else '• لا توجد قراءات حديثة'}

【الحالات المزمنة】
{patient.get('chronic_conditions_ar') or patient.get('chronic_conditions') or '• لا توجد حالات مزمنة مسجلة'}

═══════════════════════════════════════════════════════════════
                         الحساسيات الدوائية والغذائية
═══════════════════════════════════════════════════════════════
{chr(10).join([f"⚠️ {a.get('allergen_ar') or a.get('allergen')} - الشدة: {a.get('severity', 'متوسطة')} - التفاعل: {a.get('reaction_ar') or a.get('reaction') or 'غير محدد'}" for a in allergies]) if allergies else '✓ لا توجد حساسيات مسجلة'}

═══════════════════════════════════════════════════════════════
                         التشخيصات والأمراض
═══════════════════════════════════════════════════════════════
{chr(10).join([f"• [{d.get('diagnosis_code', 'N/A')}] {d.get('diagnosis_ar') or d.get('diagnosis')} - {d.get('notes_ar') or d.get('notes') or ''}" for d in diagnoses]) if diagnoses else '• لا توجد تشخيصات مسجلة'}

═══════════════════════════════════════════════════════════════
                         الأدوية الحالية
═══════════════════════════════════════════════════════════════
{chr(10).join([f"💊 {m.get('name_ar') or m.get('name')} - الجرعة: {m.get('dosage', '')} - التكرار: {m.get('frequency_ar') or m.get('frequency', '')} - من {m.get('start_date', '')} إلى {m.get('end_date', 'مستمر')}" for m in medications]) if medications else '• لا توجد أدوية مسجلة'}

═══════════════════════════════════════════════════════════════
                         سجل الزيارات الطبية ({len(visits)} زيارة)
═══════════════════════════════════════════════════════════════
{visits_context_ar if visits else '• لا توجد زيارات مسجلة'}

═══════════════════════════════════════════════════════════════
                         الصور والفحوصات الطبية
═══════════════════════════════════════════════════════════════
{chr(10).join([f"🖼️ {img.get('title_ar') or img.get('title')} ({img.get('image_type', 'other')}) - {img.get('description_ar') or img.get('description') or ''}" for img in medical_images]) if medical_images else '• لا توجد صور طبية'}

═══════════════════════════════════════════════════════════════
"""
            system_message = """أنت طبيب استشاري خبير متخصص في الطب الباطني مع خبرة 20 عاماً.

مهمتك: تحليل ملف المريض الطبي الشامل وتقديم تقرير مفصل.

⚕️ قواعد التحليل الطبي:
1. استند فقط إلى المعلومات المقدمة في ملف المريض أدناه؛ إذا لم تكن المعلومة مذكورة فقل "غير متوفرة" أو "لم تُذكر".
2. استند في التوصيات العامة إلى ممارسات موثوقة (UpToDate, Medscape, PubMed, منظمة الصحة العالمية).
3. راجع التداخلات الدوائية بين الأدوية الحالية المذكورة فقط.
4. قيّم خطورة الحساسيات وتأثيرها على خيارات العلاج.
5. حلل تطور العلامات الحيوية عبر الزيارات المدرجة.
6. قيّم مؤشر كتلة الجسم وتأثيره على الصحة العامة.
7. راجع التاريخ المرضي كاملاً كما مُلخص أدناه.

📋 قدم التقرير بالتنسيق التالي (JSON):
{
  "summary": "ملخص تنفيذي للحالة الصحية في 3-4 جمل",
  "analysis": "تحليل طبي مفصل يشمل: تقييم الحالة العامة، تحليل التشخيصات، مراجعة الأدوية والتداخلات، تقييم العلامات الحيوية",
  "risks": ["قائمة المخاطر الصحية المحددة مع مستوى الخطورة"],
  "recommendations": ["توصيات طبية محددة: فحوصات مطلوبة، تعديلات دوائية، استشارات متخصصة"],
  "patient_advice": ["نصائح للمريض: نمط الحياة، التغذية، النشاط البدني، المتابعة"],
  "drug_interactions": ["أي تداخلات دوائية محتملة بين الأدوية الحالية"],
  "follow_up": ["متى يجب المراجعة ولماذا"],
  "warnings": ["تحذيرات مهمة يجب الانتباه لها"]
}

⚠️ تحذير مهم: هذا التحليل استرشادي فقط ولا يغني عن الفحص السريري المباشر من طبيب مختص."""

        else:
            patient_summary = f"""
═══════════════════════════════════════════════════════════════
                    COMPREHENSIVE PATIENT MEDICAL FILE
═══════════════════════════════════════════════════════════════

【Basic Information】
• Name: {patient.get('name')}
• Age: {age_str}
• Gender: {patient.get('gender', 'Not specified')}
• Blood Type: {patient.get('blood_type', 'Not specified')}
• National ID: {patient.get('national_id', 'Not specified')}
• Phone: {patient.get('phone', 'Not specified')}

【Physical Measurements】
• Height: {patient.get('height_cm', 'Not specified')} cm
• Weight: {patient.get('weight_kg', 'Not specified')} kg
• BMI: {bmi_str} ({bmi_category})
{'• Pregnant: Yes - Week ' + str(patient.get('pregnancy_weeks', '')) if patient.get('is_pregnant') else ''}

【Latest Vital Signs】
{latest_vitals if latest_vitals else '• No recent readings'}

【Chronic Conditions】
{patient.get('chronic_conditions') or '• No chronic conditions recorded'}

═══════════════════════════════════════════════════════════════
                         ALLERGIES
═══════════════════════════════════════════════════════════════
{chr(10).join([f"⚠️ {a.get('allergen')} - Severity: {a.get('severity', 'moderate')} - Reaction: {a.get('reaction') or 'unspecified'}" for a in allergies]) if allergies else '✓ No allergies recorded'}

═══════════════════════════════════════════════════════════════
                         DIAGNOSES
═══════════════════════════════════════════════════════════════
{chr(10).join([f"• [{d.get('diagnosis_code', 'N/A')}] {d.get('diagnosis')} - {d.get('notes') or ''}" for d in diagnoses]) if diagnoses else '• No diagnoses recorded'}

═══════════════════════════════════════════════════════════════
                         CURRENT MEDICATIONS
═══════════════════════════════════════════════════════════════
{chr(10).join([f"💊 {m.get('name')} - Dose: {m.get('dosage', '')} - Frequency: {m.get('frequency', '')} - From {m.get('start_date', '')} to {m.get('end_date', 'ongoing')}" for m in medications]) if medications else '• No medications recorded'}

═══════════════════════════════════════════════════════════════
                         VISIT HISTORY ({len(visits)} visits)
═══════════════════════════════════════════════════════════════
{visits_context_en if visits else '• No visits recorded'}

═══════════════════════════════════════════════════════════════
                         MEDICAL IMAGES
═══════════════════════════════════════════════════════════════
{chr(10).join([f"🖼️ {img.get('title')} ({img.get('image_type', 'other')}) - {img.get('description') or ''}" for img in medical_images]) if medical_images else '• No medical images'}

═══════════════════════════════════════════════════════════════
"""
            system_message = """You are an expert consultant physician specialized in internal medicine with 20 years of experience.

Your task: Analyze the comprehensive patient medical file and provide a detailed report.

⚕️ Medical Analysis Rules:
1. Base your analysis only on the patient data provided below; if a fact is not mentioned, say "not provided" or "not recorded".
2. For general recommendations use reliable medical sources (UpToDate, Medscape, PubMed, WHO).
3. Review drug interactions only between medications listed below.
4. Assess allergy severity and impact on treatment options.
5. Analyze vital signs trends across the visits listed.
6. Evaluate BMI and its impact on overall health.
7. Review the complete medical history as summarized below.

📋 Provide report in this JSON format:
{
  "summary": "Executive summary of health status in 3-4 sentences",
  "analysis": "Detailed medical analysis including: overall condition assessment, diagnosis analysis, medication review and interactions, vital signs evaluation",
  "risks": ["List of specific health risks with severity level"],
  "recommendations": ["Specific medical recommendations: required tests, medication adjustments, specialist consultations"],
  "patient_advice": ["Patient advice: lifestyle, nutrition, physical activity, follow-up"],
  "drug_interactions": ["Any potential drug interactions between current medications"],
  "follow_up": ["When and why follow-up is needed"],
  "warnings": ["Important warnings to note"]
}

⚠️ Important: This analysis is advisory only and does not replace direct clinical examination by a specialist."""
        
        # Ensure context fits model limit so response is not truncated
        patient_summary = ensure_context_fits(patient_summary, max_tokens=DEFAULT_MAX_CONTEXT_TOKENS)

        image_base64_list = []
        if request.include_images and medical_images:
            for img in medical_images[:6]:
                img_data = img.get('image_base64', '')
                if img_data:
                    image_base64_list.append(img_data)

        response = await _openai_chat(system_message, patient_summary, image_base64_list=image_base64_list if image_base64_list else None, company_id=current_user.get("company_id"))
        result = _parse_ai_json(response)
        data_analyzed = {
            "allergies_count": len(allergies),
            "diagnoses_count": len(diagnoses),
            "medications_count": len(medications),
            "images_count": len(medical_images),
            "visits_count": len(visits)
        }
        if result is not None:
            return {
                "patient_id": request.patient_id,
                "summary": result.get("summary", ""),
                "analysis": result.get("analysis", response),
                "risks": result.get("risks", []),
                "recommendations": result.get("recommendations", []),
                "patient_advice": result.get("patient_advice", []),
                "drug_interactions": result.get("drug_interactions", []),
                "follow_up": result.get("follow_up", []),
                "warnings": result.get("warnings", []),
                "data_analyzed": data_analyzed
            }
        return {
            "patient_id": request.patient_id,
            "analysis": response,
            "summary": "",
            "risks": [],
            "recommendations": [],
            "patient_advice": [],
            "drug_interactions": [],
            "follow_up": [],
            "warnings": ["Could not parse structured response"],
            "data_analyzed": data_analyzed
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Patient AI analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Patient analysis failed: {str(e)}")

# ==================== ADVANCED AI FEATURES ====================

# AI Chat Sessions: persisted in MongoDB (was in-memory; now survives restart)

class AIChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AIChatRequest(BaseModel):
    patient_id: Optional[str] = None
    message: str
    session_id: Optional[str] = None
    language: str = "ar"

class SmartSymptomRequest(BaseModel):
    symptoms: List[str]
    patient_id: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    chronic_conditions: Optional[List[str]] = None
    current_medications: Optional[List[str]] = None
    language: str = "ar"

class DrugInteractionRequest(BaseModel):
    medications: List[str]
    patient_id: Optional[str] = None
    language: str = "ar"

class AIReportRequest(BaseModel):
    patient_id: str
    report_type: str = "monthly"  # monthly, quarterly, referral
    language: str = "ar"

class AIInsightCreate(BaseModel):
    patient_id: str
    type: str  # symptom_analysis | image_analysis | drug_interaction | report
    payload: dict

class AIInsightUpdate(BaseModel):
    status: Optional[str] = None  # pending_review | accepted | rejected
    notes: Optional[str] = None
    visit_id: Optional[str] = None


class MedicalImageAnalysisRequest(BaseModel):
    """Request body for advanced medical image analysis (X-Ray, ECG, Lab, etc.)."""
    image_type: str  # xray, ecg, lab, other
    image_base64: str
    patient_id: Optional[str] = None
    clinical_context: Optional[str] = None
    language: str = "ar"


# 1. SMART SYMPTOM ANALYZER - Interactive diagnosis assistant
@api_router.post("/ai/smart-symptoms", tags=["AI"])
async def smart_symptom_analyzer(request: SmartSymptomRequest, req: Request, current_user: dict = Depends(require_feature("ai_analysis"))):
    """Advanced symptom analysis with follow-up questions and differential diagnosis"""
    await log_audit("ai_request", "ai", user=current_user, details={"endpoint": "smart-symptoms", "patient_id": request.patient_id}, request=req)
    try:
        # Get patient history if patient_id provided
        patient_context = ""
        if request.patient_id:
            patient = await db.patients.find_one({"id": request.patient_id}, {"_id": 0})
            allergies = await db.allergies.find({"patient_id": request.patient_id}, {"_id": 0}).to_list(50)
            medications = await db.medications.find({"patient_id": request.patient_id}, {"_id": 0}).to_list(50)
            if patient:
                patient_context = f"""
سياق المريض:
- العمر: {request.age or 'غير محدد'}
- الجنس: {request.gender or patient.get('gender', 'غير محدد')}
- الحالات المزمنة: {', '.join(request.chronic_conditions or []) or patient.get('chronic_conditions', 'لا يوجد')}
- الأدوية الحالية: {', '.join([m.get('name_ar', m.get('name', '')) for m in medications]) or 'لا يوجد'}
- الحساسيات: {', '.join([a.get('allergen_ar', a.get('allergen', '')) for a in allergies]) or 'لا يوجد'}
"""
        
        lang = request.language
        if lang == "ar":
            system_message = """أنت طبيب استشاري خبير في التشخيص التفريقي مع خبرة 25 عاماً.

مهمتك: تحليل الأعراض المقدمة وتقديم تشخيص تفريقي شامل.

⚕️ منهجية التحليل:
1. تحليل كل عرض على حدة.
2. ربط الأعراض ببعضها للوصول للتشخيص الأرجح.
3. استبعاد التشخيصات الخطيرة أولاً (Red Flags).
4. مراعاة السياق الجغرافي (الشرق الأوسط).
5. استخدم فقط سياق المريض المقدم أدناه (العمر، الجنس، الأدوية، الحساسيات)؛ إن لم يُذكر شيء فقل "غير متوفر".

📋 قدم الرد بصيغة JSON:
{
  "primary_diagnosis": {"name": "التشخيص الأرجح", "probability": "نسبة الاحتمال", "icd_code": "رمز ICD"},
  "differential_diagnoses": [{"name": "تشخيص", "probability": "نسبة", "reasoning": "السبب"}],
  "red_flags": ["أعراض خطيرة تستدعي تدخل فوري"],
  "follow_up_questions": ["أسئلة إضافية لتأكيد التشخيص"],
  "recommended_tests": ["الفحوصات المطلوبة"],
  "immediate_actions": ["إجراءات فورية مطلوبة"],
  "when_to_seek_emergency": ["متى يجب الذهاب للطوارئ"],
  "home_care": ["نصائح للعناية المنزلية"]
}

⚠️ تحذير: هذا تحليل استرشادي ولا يغني عن الفحص السريري."""
        else:
            system_message = """You are an expert consultant physician in differential diagnosis with 25 years experience.

Your task: Analyze symptoms and provide comprehensive differential diagnosis.

Provide response in JSON format with: primary_diagnosis, differential_diagnoses, red_flags, follow_up_questions, recommended_tests, immediate_actions, when_to_seek_emergency, home_care"""
        
        symptoms_text = "الأعراض: " + "، ".join(request.symptoms)
        if patient_context:
            symptoms_text = patient_context + "\n\n" + symptoms_text
        
        response = await _openai_chat(system_message, symptoms_text, company_id=current_user.get("company_id"))
        result = _parse_ai_json(response)
        if result is not None:
            return result
        return {"analysis": response, "error": "Could not parse structured response"}
    except Exception as e:
        logger.error(f"Smart symptom analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 2. AI MEDICAL ASSISTANT CHAT
@api_router.post("/ai/chat", tags=["AI"])
async def ai_medical_chat(request: AIChatRequest, req: Request, current_user: dict = Depends(require_feature("ai_analysis"))):
    """Interactive AI medical assistant chat (sessions persisted in MongoDB)."""
    await log_audit("ai_request", "ai", user=current_user, details={"endpoint": "chat", "patient_id": request.patient_id}, request=req)
    try:
        session_id = request.session_id or str(uuid.uuid4())
        company_id = current_user.get("company_id")
        user_id = current_user.get("id")

        # Get or create chat session from MongoDB (scope by company)
        session_doc = await db.ai_chat_sessions.find_one({"id": session_id, "company_id": company_id})
        if not session_doc:
            session_doc = {
                "id": session_id,
                "company_id": company_id,
                "user_id": user_id,
                "patient_id": request.patient_id,
                "messages": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.ai_chat_sessions.insert_one(session_doc)

        session_messages = session_doc.get("messages") or []

        # Get patient context if available
        patient_context = ""
        if request.patient_id:
            patient = await db.patients.find_one({"id": request.patient_id}, {"_id": 0})
            if patient:
                visits = await db.visits.find({"patient_id": request.patient_id}, {"_id": 0}).sort("created_at", -1).to_list(30)
                medications = await db.medications.find({"patient_id": request.patient_id}, {"_id": 0}).to_list(50)
                visits_ctx_ar, _ = build_visits_context_with_summary(visits, max_recent_months=12, max_recent_count=15, lang_ar=True)
                patient_context = f"""
المريض الحالي: {patient.get('name_ar', patient.get('name', 'غير محدد'))}
الجنس: {patient.get('gender', 'غير محدد')}
الأدوية الحالية: {', '.join([m.get('name_ar', m.get('name', '')) for m in medications[:30]]) or 'لا يوجد'}
سجل الزيارات (ملخص):
{visits_ctx_ar[:4000] if len(visits_ctx_ar) > 4000 else visits_ctx_ar}
"""
        
        lang = request.language
        if lang == "ar":
            system_message = f"""أنت مساعد طبي ذكي اسمه "طبي AI" تعمل في عيادة طبية.

🏥 صلاحياتك:
- الإجابة على الأسئلة الطبية العامة
- شرح الأدوية وجرعاتها وآثارها الجانبية
- تفسير نتائج التحاليل المخبرية
- شرح التشخيصات الطبية بلغة بسيطة
- تقديم نصائح صحية عامة
- المساعدة في فهم الوصفات الطبية

⚠️ قيود مهمة:
- لا تقدم تشخيصاً نهائياً - اقترح فقط
- ذكّر دائماً بضرورة استشارة الطبيب
- لا تصف أدوية بدون وصفة طبية
- في الحالات الطارئة، وجّه للطوارئ فوراً

{patient_context}

كن ودوداً ومحترفاً. استخدم لغة بسيطة يفهمها المريض."""
        else:
            system_message = f"""You are an intelligent medical assistant named "Tebbi AI" working in a medical clinic.

{patient_context}

Be friendly and professional. Use simple language."""
        
        messages = [{"role": "system", "content": system_message}]
        for msg in session_messages[-20:]:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        messages.append({"role": "user", "content": request.message})

        response = await _openai_chat_messages(messages, company_id=company_id)

        # Persist new messages to MongoDB
        now_iso = datetime.now(timezone.utc).isoformat()
        new_messages = session_messages + [
            {"role": "user", "content": request.message, "timestamp": now_iso},
            {"role": "assistant", "content": response, "timestamp": now_iso},
        ]
        await db.ai_chat_sessions.update_one(
            {"id": session_id},
            {"$set": {"messages": new_messages, "updated_at": now_iso}},
        )

        return {
            "session_id": session_id,
            "response": response,
            "message_count": len(new_messages),
        }
    except Exception as e:
        logger.error(f"AI chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 3. DRUG INTERACTION CHECKER
@api_router.post("/ai/drug-interactions", tags=["AI"])
async def check_drug_interactions(request: DrugInteractionRequest, req: Request, current_user: dict = Depends(require_feature("ai_analysis"))):
    """Check for dangerous drug interactions"""
    await log_audit("ai_request", "ai", user=current_user, details={"endpoint": "drug-interactions", "patient_id": request.patient_id}, request=req)
    try:
        # Get patient medications if patient_id provided
        all_medications = list(request.medications)
        if request.patient_id:
            patient_meds = await db.medications.find({"patient_id": request.patient_id}, {"_id": 0}).to_list(50)
            for med in patient_meds:
                med_name = med.get('name_ar', med.get('name', ''))
                if med_name and med_name not in all_medications:
                    all_medications.append(med_name)
        
        lang = request.language
        if lang == "ar":
            system_message = """أنت صيدلي سريري خبير متخصص في التداخلات الدوائية.

مهمتك: فحص قائمة الأدوية وتحديد أي تداخلات دوائية محتملة.

📋 قدم الرد بصيغة JSON:
{
  "interactions": [
    {
      "drugs": ["الدواء 1", "الدواء 2"],
      "severity": "خطير/متوسط/خفيف",
      "description": "وصف التداخل",
      "mechanism": "آلية التداخل",
      "clinical_effect": "التأثير السريري",
      "recommendation": "التوصية"
    }
  ],
  "contraindications": ["موانع استعمال"],
  "warnings": ["تحذيرات عامة"],
  "safe_combinations": ["تركيبات آمنة"],
  "monitoring_required": ["ما يجب مراقبته"]
}"""
        else:
            system_message = """You are an expert clinical pharmacist specialized in drug interactions. Analyze medications and identify potential interactions. Provide response in JSON format."""
        
        meds_text = "الأدوية للفحص:\n" + "\n".join([f"- {med}" for med in all_medications])
        
        response = await _openai_chat(system_message, meds_text, company_id=current_user.get("company_id"))
        result = _parse_ai_json(response)
        if result is not None:
            result["medications_checked"] = all_medications
            return result
        return {"analysis": response, "medications_checked": all_medications}
    except Exception as e:
        logger.error(f"Drug interaction check error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 4. SMART ALERTS - Check patient data for alerts
@api_router.get("/ai/alerts/{patient_id}", tags=["AI"])
async def get_smart_alerts(patient_id: str, req: Request, current_user: dict = Depends(require_feature("ai_analysis"))):
    """Get AI-generated smart alerts for a patient"""
    await log_audit("ai_request", "ai", user=current_user, details={"endpoint": "alerts", "patient_id": patient_id}, request=req)
    try:
        # Fetch patient data
        patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        allergies = await db.allergies.find({"patient_id": patient_id}, {"_id": 0}).to_list(50)
        medications = await db.medications.find({"patient_id": patient_id}, {"_id": 0}).to_list(50)
        visits = await db.visits.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(10)
        invoices = await db.invoices.find({"patient_id": patient_id, "payment_status": "pending"}, {"_id": 0}).to_list(50)
        
        # Build context
        context = f"""
بيانات المريض للتحليل:
- الاسم: {patient.get('name_ar', patient.get('name', ''))}
- الجنس: {patient.get('gender', '')}
- فصيلة الدم: {patient.get('blood_type', '')}
- الطول: {patient.get('height_cm', '')} سم
- الوزن: {patient.get('weight_kg', '')} كغ

الحساسيات ({len(allergies)}):
{chr(10).join([f"- {a.get('allergen_ar', a.get('allergen', ''))} (شدة: {a.get('severity', '')})" for a in allergies])}

الأدوية الحالية ({len(medications)}):
{chr(10).join([f"- {m.get('name_ar', m.get('name', ''))}: {m.get('dosage', '')}" for m in medications])}

آخر الزيارات ({len(visits)}):
{chr(10).join([f"- {str(v.get('created_at', ''))[:10]}: {v.get('reason', '')} | الضغط: {v.get('blood_pressure_systolic', '-')}/{v.get('blood_pressure_diastolic', '-')}" + (f" | السكر: {v.get('blood_sugar', '-')}" if v.get('blood_sugar') else "") for v in visits[:5]])}

الوصفات من الزيارات (آخر 5 زيارات):
{chr(10).join([f"- زيارة {str(v.get('created_at', ''))[:10]}: " + ", ".join([p.get('medication_name', p.get('name', '')) for p in (v.get('prescription') or [])]) for v in visits[:5] if v.get('prescription')]) or "- لا توجد"}

فواتير معلقة: {len(invoices)} (إجمالي مستحق: {sum((inv.get("total") or 0) - (inv.get("paid_amount") or 0) for inv in invoices)})
"""
        
        system_message = """أنت نظام تنبيهات طبية ذكي. حلل بيانات المريض وأنشئ تنبيهات مهمة.

📋 قدم الرد بصيغة JSON:
{
  "critical_alerts": [{"type": "نوع", "message": "رسالة", "action": "الإجراء المطلوب"}],
  "warnings": [{"type": "نوع", "message": "رسالة", "action": "الإجراء"}],
  "reminders": [{"type": "نوع", "message": "رسالة", "due_date": "التاريخ"}],
  "medication_alerts": [{"drug": "الدواء", "alert": "التنبيه", "severity": "الخطورة"}],
  "follow_up_needed": [{"reason": "السبب", "recommended_date": "التاريخ المقترح"}],
  "lab_tests_due": [{"test": "الفحص", "reason": "السبب", "urgency": "الأولوية"}]
}"""
        
        response = await _openai_chat(system_message, context, company_id=current_user.get("company_id"))
        result = _parse_ai_json(response)
        if result is not None:
            result["patient_id"] = patient_id
            result["generated_at"] = datetime.now(timezone.utc).isoformat()
            return result
        # Fallback: return structured empty so frontend always gets same shape
        return {
            "patient_id": patient_id,
            "critical_alerts": [],
            "warnings": [],
            "reminders": [],
            "medication_alerts": [],
            "follow_up_needed": [],
            "lab_tests_due": [],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Smart alerts error: {str(e)}")
        # Return empty structure instead of 500 when AI unavailable, so panel still renders
        try:
            return {
                "patient_id": patient_id,
                "critical_alerts": [],
                "warnings": [],
                "reminders": [],
                "medication_alerts": [],
                "follow_up_needed": [],
                "lab_tests_due": [],
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "_error": str(e),
            }
        except Exception:
            raise HTTPException(status_code=500, detail=str(e))

def _safe_str(x, default=""):
    """Convert any value to string for report context (avoid TypeError from datetime/None)."""
    if x is None:
        return default
    if isinstance(x, (str, int, float, bool)):
        return str(x)
    if hasattr(x, "isoformat"):
        return str(getattr(x, "isoformat")())[:10]
    return str(x)[:200]


def _dict_to_formatted_report_ar(data: dict) -> str:
    """Turn AI JSON result into one readable Arabic text for display/edit. Excludes meta keys."""
    skip = {"patient_id", "report_type", "generated_at", "generated_by"}
    parts = []
    for k, v in data.items():
        if k in skip or v is None:
            continue
        if isinstance(v, dict):
            v = "\n".join(f"  • {kk}: {vv}" for kk, vv in v.items() if vv is not None)
        elif isinstance(v, list):
            v = "\n".join(f"  • {item}" for item in v if item is not None)
        else:
            v = str(v).strip()
        if v:
            parts.append(f"{k}\n{v}")
    return "\n\n".join(parts) if parts else ""


def _build_fallback_report_ar(lines: list) -> str:
    """Build a simple text report from context when AI is unavailable."""
    return "\n".join(lines)


# 5. AI MEDICAL REPORT GENERATOR
@api_router.post("/ai/generate-report", tags=["AI"])
async def generate_ai_report(request: AIReportRequest, req: Request, current_user: dict = Depends(require_feature("ai_analysis"))):
    """Generate comprehensive AI medical reports"""
    await log_audit("ai_request", "ai", user=current_user, details={"endpoint": "generate-report", "patient_id": request.patient_id}, request=req)
    try:
        # Fetch all patient data
        patient = await db.patients.find_one({"id": request.patient_id}, {"_id": 0})
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        allergies = await db.allergies.find({"patient_id": request.patient_id}, {"_id": 0}).to_list(100)
        diagnoses = await db.diagnoses.find({"patient_id": request.patient_id}, {"_id": 0}).to_list(100)
        medications = await db.medications.find({"patient_id": request.patient_id}, {"_id": 0}).to_list(100)
        visits = await db.visits.find({"patient_id": request.patient_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
        medical_images = await db.medical_images.find({"patient_id": request.patient_id}, {"_id": 0}).to_list(20)
        
        # Build context safely (no TypeError from datetime/None)
        lines = [
            "═══════════════════════════════════════════════════════════════",
            "                    تقرير طبي شامل للمريض",
            "═══════════════════════════════════════════════════════════════",
            "",
            "【معلومات المريض】",
            f"• الاسم: {_safe_str(patient.get('name_ar') or patient.get('name'))}",
            f"• تاريخ الميلاد: {_safe_str(patient.get('date_of_birth'))}",
            f"• الجنس: {_safe_str(patient.get('gender'))}",
            f"• فصيلة الدم: {_safe_str(patient.get('blood_type'))}",
            f"• الطول/الوزن: {_safe_str(patient.get('height_cm'))} سم / {_safe_str(patient.get('weight_kg'))} كغ",
            f"• رقم الهوية: {_safe_str(patient.get('national_id'))}",
            "",
            "【الحساسيات】",
        ]
        if allergies:
            for a in allergies:
                lines.append(f"• {_safe_str(a.get('allergen_ar') or a.get('allergen'))} - الشدة: {_safe_str(a.get('severity'))}")
        else:
            lines.append("• لا توجد")
        lines.append("")
        lines.append("【التشخيصات】")
        if diagnoses:
            for d in diagnoses:
                lines.append(f"• {_safe_str(d.get('diagnosis_ar') or d.get('diagnosis'))} [{_safe_str(d.get('diagnosis_code'))}]")
        else:
            lines.append("• لا توجد")
        lines.append("")
        lines.append("【الأدوية الحالية】")
        if medications:
            for m in medications:
                lines.append(f"• {_safe_str(m.get('name_ar') or m.get('name'))}: {_safe_str(m.get('dosage'))} - {_safe_str(m.get('frequency_ar') or m.get('frequency'))}")
        else:
            lines.append("• لا توجد")
        lines.append("")
        lines.append(f"【سجل الزيارات ({len(visits)} زيارة)】")
        if visits:
            visits_ctx_ar, _ = build_visits_context_with_summary(visits, max_recent_months=24, max_recent_count=40, lang_ar=True)
            lines.append(visits_ctx_ar)
        else:
            lines.append("• لا توجد")
        lines.append("")
        lines.append(f"【الصور الطبية ({len(medical_images)})】")
        if medical_images:
            for img in medical_images:
                lines.append(f"• {_safe_str(img.get('title_ar') or img.get('title'))} - {_safe_str(img.get('image_type'))}")
        else:
            lines.append("• لا توجد")
        context = "\n".join(lines)
        context = ensure_context_fits(context, max_tokens=DEFAULT_MAX_CONTEXT_TOKENS)

        report_type = request.report_type
        fallback_content = _build_fallback_report_ar(lines)

        def _pick_prompt_ar():
            if report_type == "referral":
                return """أنت طبيب يكتب تقرير تحويل لزميل متخصص.
اكتب تقرير تحويل طبي رسمي ومفصل يتضمن:
- ملخص الحالة (تفصيلي)
- التاريخ المرضي الكامل
- الفحوصات والنتائج المهمة
- التشخيص الحالي والمضاعفات إن وجدت
- سبب التحويل بوضوح
- التوصيات والعلاجات المقترحة

قدم التقرير بصيغة JSON مع تعبئة كل حقل بمحتوى واضح وليس فارغاً:
{
  "report_title": "عنوان التقرير",
  "patient_summary": "ملخص المريض",
  "medical_history": "التاريخ المرضي",
  "current_condition": "الحالة الحالية",
  "investigations": "الفحوصات",
  "diagnosis": "التشخيص",
  "referral_reason": "سبب التحويل",
  "recommendations": "التوصيات",
  "doctor_notes": "ملاحظات الطبيب"
}"""
            if report_type == "case_summary":
                return """أنت طبيب يكتب خلاصة حالة سريرية.
اكتب خلاصة حالة مفصلة تتضمن:
- عرض الحالة والسبب المراجعة
- القصة المرضية والأعراض
- الفحص السريري والنتائج
- التشخيص والتفريقات
- الخطة العلاجية والمتابعة

قدم التقرير بصيغة JSON مع تعبئة كل حقل بمحتوى واضح:
{
  "report_title": "خلاصة الحالة",
  "chief_complaint": "سبب المراجعة",
  "history": "القصة المرضية",
  "examination": "الفحص السريري",
  "diagnosis": "التشخيص",
  "differential": "التفريقات",
  "treatment_plan": "الخطة العلاجية",
  "follow_up": "المتابعة"
}"""
            if report_type == "lab_report":
                return """أنت طبيب يلخص النتائج المخبرية للمريض في تقرير واضح.
استخدم بيانات الزيارات والفحوصات إن وردت. اكتب تقرير مختبر يتضمن:
- ملخص طلب الفحوصات
- النتائج المتوفرة وتفسيرها
- القيم خارج النطاق الطبيعي إن وجدت
- التوصيات (إعادة فحص، متابعة، إلخ)

قدم التقرير بصيغة JSON:
{
  "report_title": "تقرير مختبر",
  "summary": "ملخص الفحوصات",
  "results_interpretation": "تفسير النتائج",
  "abnormal_findings": "النتائج غير الطبيعية",
  "recommendations": "التوصيات"
}"""
            if report_type == "follow_up":
                return """أنت طبيب يكتب تقرير متابعة دورية للمريض.
اكتب تقرير متابعة واضح يتضمن:
- ملخص الحالة منذ آخر زيارة
- التزام المريض بالعلاج والتحسن
- أي أعراض أو مضاعفات جديدة
- التوصيات وموعد المتابعة القادم

قدم التقرير بصيغة JSON:
{
  "report_title": "تقرير المتابعة",
  "period_summary": "ملخص الفترة",
  "treatment_adherence": "الالتزام بالعلاج",
  "new_findings": "ملاحظات جديدة",
  "recommendations": "التوصيات",
  "next_visit": "موعد المتابعة القادم"
}"""
            if report_type == "discharge_summary":
                return """أنت طبيب يكتب تقرير خروج للمريض.
اكتب تقرير خروج واضح يتضمن:
- سبب الدخول والتشخيص النهائي
- الإجراءات والعلاجات أثناء الإقامة
- الحالة عند الخروج والتعليمات
- الأدوية والمواعيد والمتابعة

قدم التقرير بصيغة JSON:
{
  "report_title": "تقرير الخروج",
  "admission_reason": "سبب الدخول",
  "final_diagnosis": "التشخيص النهائي",
  "procedures_treatment": "الإجراءات والعلاج",
  "discharge_condition": "الحالة عند الخروج",
  "medications_instructions": "الأدوية والتعليمات",
  "follow_up": "المتابعة"
}"""
            # monthly / quarterly / default
            return """أنت طبيب يكتب تقرير متابعة دوري للمريض.
اكتب تقرير طبي شامل ومفصل يتضمن:
- ملخص الحالة الصحية (واضح ومفصل)
- تطور الحالة خلال الفترة
- تحليل العلامات الحيوية إن وجدت
- فعالية العلاج الحالي
- نقاط القلق والتحسينات
- التوصيات والخطوات القادمة وموعد المتابعة

قدم التقرير بصيغة JSON مع تعبئة كل حقل بمحتوى واضح وليس مختصراً جداً:
{
  "report_title": "عنوان التقرير",
  "period": "فترة التقرير",
  "executive_summary": "الملخص التنفيذي",
  "health_status": "الحالة الصحية العامة",
  "vital_signs_trend": "تطور العلامات الحيوية",
  "treatment_effectiveness": "فعالية العلاج",
  "concerns": "نقاط القلق",
  "achievements": "التحسينات",
  "recommendations": "التوصيات",
  "next_steps": "الخطوات القادمة",
  "follow_up_date": "موعد المتابعة القادم"
}"""

        if request.language == "ar":
            system_message = _pick_prompt_ar()
        else:
            system_message = "You are a physician writing a medical report. Provide response in JSON format with all fields filled clearly."

        try:
            provider, api_key = await _get_ai_config(current_user.get("company_id"))
            if not api_key:
                raise ValueError("No AI API key configured")
            response = await _openai_chat(system_message, context, company_id=current_user.get("company_id"))
        except Exception as ai_err:
            logger.warning(f"AI report fallback: {ai_err}")
            return {
                "patient_id": request.patient_id,
                "report_type": report_type,
                "content": fallback_content,
                "formatted_content": fallback_content,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "generated_by": current_user.get("name", "AI System"),
                "_fallback": True,
            }

        result = _parse_ai_json(response)
        if result is not None:
            result["patient_id"] = request.patient_id
            result["report_type"] = report_type
            result["generated_at"] = datetime.now(timezone.utc).isoformat()
            result["generated_by"] = current_user.get("name", "AI System")
            result["formatted_content"] = _dict_to_formatted_report_ar(result)
            return result
        # AI returned non-JSON or empty
        text = (response or "").strip() or fallback_content
        return {
            "patient_id": request.patient_id,
            "report_type": report_type,
            "content": text,
            "formatted_content": text,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Report generation error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# AI INSIGHTS - Store and retrieve AI suggestions per patient
@api_router.post("/ai/insights", tags=["AI"])
async def create_ai_insight(request: AIInsightCreate, req: Request, current_user: dict = Depends(require_feature("ai_analysis"))):
    """Save an AI result to the patient's file for review."""
    await log_audit("ai_request", "ai", user=current_user, details={"endpoint": "insights-create", "patient_id": request.patient_id}, request=req)
    try:
        patient = await db.patients.find_one({"id": request.patient_id}, {"_id": 0})
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        insight_id = str(uuid.uuid4())
        doc = {
            "id": insight_id,
            "patient_id": request.patient_id,
            "type": request.type,
            "payload": request.payload,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user.get("id"),
            "status": "pending_review",
            "notes": None,
            "visit_id": None,
        }
        await db.ai_insights.insert_one(doc)
        return {"id": insight_id, **doc}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI insight create error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/ai/insights", tags=["AI"])
async def get_ai_insights(patient_id: str, req: Request, current_user: dict = Depends(require_feature("ai_analysis"))):
    """List AI insights for a patient."""
    await log_audit("ai_request", "ai", user=current_user, details={"endpoint": "insights-list", "patient_id": patient_id}, request=req)
    try:
        cursor = db.ai_insights.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1)
        items = await cursor.to_list(100)
        return items
    except Exception as e:
        logger.error(f"AI insights list error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/ai/insights/{insight_id}", tags=["AI"])
async def update_ai_insight(insight_id: str, request: AIInsightUpdate, req: Request, current_user: dict = Depends(require_feature("ai_analysis"))):
    """Update status, notes, or visit_id of an AI insight."""
    await log_audit("ai_request", "ai", user=current_user, details={"endpoint": "insights-update", "insight_id": insight_id}, request=req)
    try:
        update_data = {}
        if request.status is not None:
            update_data["status"] = request.status
        if request.notes is not None:
            update_data["notes"] = request.notes
        if request.visit_id is not None:
            update_data["visit_id"] = request.visit_id
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        result = await db.ai_insights.update_one(
            {"id": insight_id},
            {"$set": update_data}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="AI insight not found")
        updated = await db.ai_insights.find_one({"id": insight_id}, {"_id": 0})
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI insight update error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 6. ADVANCED IMAGE ANALYSIS (X-Ray, ECG, Lab Results)
@api_router.post("/ai/analyze-medical-image", tags=["AI"])
async def analyze_medical_image_advanced(
    request: MedicalImageAnalysisRequest,
    req: Request,
    current_user: dict = Depends(require_feature("ai_analysis"))
):
    """Advanced medical image analysis for X-Ray, ECG, and Lab results. Accepts JSON body."""
    await log_audit("ai_request", "ai", user=current_user, details={"endpoint": "analyze-medical-image", "patient_id": request.patient_id}, request=req)
    try:
        image_type = request.image_type
        image_base64 = request.image_base64
        patient_id = request.patient_id
        clinical_context = request.clinical_context
        language = request.language
        # Get patient context if available
        patient_context = ""
        if patient_id:
            patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
            if patient:
                patient_context = f"""
معلومات المريض:
- الاسم: {patient.get('name_ar', patient.get('name', ''))}
- العمر: {patient.get('date_of_birth', '')}
- الجنس: {patient.get('gender', '')}
"""
        
        # System message based on image type
        if language == "ar":
            if image_type == "xray":
                system_message = """أنت أخصائي أشعة خبير. حلل صورة الأشعة السينية المقدمة.

📋 قدم التحليل بصيغة JSON:
{
  "image_quality": "جودة الصورة",
  "anatomical_structures": ["الهياكل التشريحية المرئية"],
  "findings": [{"location": "الموقع", "finding": "الملاحظة", "significance": "الأهمية"}],
  "abnormalities": [{"type": "النوع", "description": "الوصف", "severity": "الشدة"}],
  "differential_diagnosis": ["التشخيصات التفريقية"],
  "recommendations": ["التوصيات"],
  "comparison_needed": "هل يلزم مقارنة مع صور سابقة",
  "urgency": "مستوى الاستعجال"
}"""
            elif image_type == "ecg":
                system_message = """أنت أخصائي قلب خبير في قراءة تخطيط القلب. حلل صورة ECG المقدمة.

📋 قدم التحليل بصيغة JSON:
{
  "rhythm": "إيقاع القلب",
  "rate": "معدل ضربات القلب",
  "axis": "محور القلب",
  "intervals": {"PR": "", "QRS": "", "QT": ""},
  "waves": {"P": "", "QRS": "", "T": "", "ST": ""},
  "findings": [{"finding": "الملاحظة", "significance": "الأهمية", "lead": "المشتقة"}],
  "abnormalities": [{"type": "النوع", "description": "الوصف", "urgency": "الاستعجال"}],
  "diagnosis": "التشخيص",
  "recommendations": ["التوصيات"],
  "urgency": "مستوى الاستعجال"
}"""
            elif image_type == "lab":
                system_message = """أنت أخصائي مختبرات طبية. حلل نتائج التحاليل المخبرية المقدمة.

📋 قدم التحليل بصيغة JSON:
{
  "test_type": "نوع التحليل",
  "results": [{"test": "الفحص", "value": "القيمة", "unit": "الوحدة", "reference": "المرجع", "status": "طبيعي/مرتفع/منخفض"}],
  "abnormal_findings": [{"test": "الفحص", "interpretation": "التفسير", "clinical_significance": "الأهمية السريرية"}],
  "possible_causes": ["الأسباب المحتملة للنتائج غير الطبيعية"],
  "recommendations": ["التوصيات"],
  "follow_up_tests": ["فحوصات متابعة مطلوبة"],
  "urgency": "مستوى الاستعجال"
}"""
            else:
                system_message = """أنت طبيب خبير في تحليل الصور الطبية. حلل الصورة المقدمة وقدم تقريراً شاملاً بصيغة JSON."""
        else:
            system_message = f"You are an expert medical image analyst for {image_type}. Provide analysis in JSON format."
        
        context_text = patient_context
        if clinical_context:
            context_text += f"\nالسياق السريري: {clinical_context}"
        
        response = await _openai_chat(system_message, context_text or "حلل هذه الصورة الطبية", image_base64_list=[image_base64], company_id=current_user.get("company_id"))
        result = _parse_ai_json(response)
        if result is not None:
            result["image_type"] = image_type
            result["analyzed_at"] = datetime.now(timezone.utc).isoformat()
            return result
        return {"image_type": image_type, "analysis": response}
    except Exception as e:
        logger.error(f"Medical image analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== MULTI-TENANT SAAS APIs ====================

# التخصصات بالعربي والإنجليزي
SPECIALTIES = {
    "general": {"en": "General Medicine", "ar": "طب عام"},
    "cardiology": {"en": "Cardiology", "ar": "أمراض القلب"},
    "dermatology": {"en": "Dermatology", "ar": "الجلدية"},
    "pediatrics": {"en": "Pediatrics", "ar": "طب الأطفال"},
    "orthopedics": {"en": "Orthopedics", "ar": "العظام"},
    "gynecology": {"en": "Gynecology", "ar": "النسائية والتوليد"},
    "ophthalmology": {"en": "Ophthalmology", "ar": "طب العيون"},
    "ent": {"en": "ENT", "ar": "الأنف والأذن والحنجرة"},
    "neurology": {"en": "Neurology", "ar": "الأعصاب"},
    "psychiatry": {"en": "Psychiatry", "ar": "الطب النفسي"},
    "dentistry": {"en": "Dentistry", "ar": "طب الأسنان"},
    "internal": {"en": "Internal Medicine", "ar": "الباطنية"},
    "surgery": {"en": "Surgery", "ar": "الجراحة"},
    "other": {"en": "Other", "ar": "أخرى"}
}

# Get specialties list
@api_router.get("/specialties", tags=["Users"])
async def get_specialties():
    return {"specialties": SPECIALTIES}

# ==================== COMPANY (CLINIC) MANAGEMENT ====================

# Create new company (Super Admin only)
@api_router.post("/companies", tags=["Companies"])
async def create_company(company: CompanyCreate, request: Request, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can create companies")
    
    # Check if code already exists
    existing = await db.companies.find_one({"code": company.code})
    if existing:
        raise HTTPException(status_code=400, detail="Company code already exists")
    
    # Create company
    company_data = {
        "id": str(uuid.uuid4()),
        "name": company.name,
        "name_ar": company.name_ar,
        "code": company.code.upper(),
        "email": company.email,
        "phone": company.phone,
        "address": company.address,
        "address_ar": company.address_ar,
        "logo_base64": company.logo_base64,
        "website": company.website,
        "specialty": company.specialty,
        "is_active": True,
        "subscription_status": "trial",
        "subscription_end_date": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
        "trial_days": 14,
        "max_users": 5,
        "max_patients": 1000,
        "max_storage_mb": 1024,
        "features": {
            "dashboard": True,
            "patients": True,
            "appointments": True,
            "queue": True,
            "invoices": True,
            "ai_analysis": True,
            "reports": True,
            "online_booking": True,
            "notifications": True,
            "pdf_printing": True,
            "backup": True,
            "pharmacy": True,
            "consent": True,
            "marketing": True,
            "audit_logs": True,
        },
        "users_count": 1,
        "patients_count": 0,
        "storage_used_mb": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    if company_data.get("phone"):
        company_data["phone"] = encrypt_field(company_data["phone"])
    if company_data.get("email"):
        company_data["email"] = encrypt_field(company_data["email"])
    await db.companies.insert_one(company_data)
    await log_audit("create", "company", resource_id=company_data["id"], user=current_user, details={"code": company_data["code"]}, request=request)

    # Create company admin user
    admin_user = {
        "id": str(uuid.uuid4()),
        "email": company.admin_email,
        "password": hash_password(company.admin_password),
        "name": company.admin_name,
        "name_ar": company.admin_name,
        "role": "company_admin",
        "company_id": company_data["id"],
        "phone": company.phone,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    if admin_user.get("phone"):
        admin_user["phone"] = encrypt_field(admin_user["phone"])
    await db.users.insert_one(admin_user)
    
    company_data.pop("_id", None)
    if company_data.get("phone"):
        company_data["phone"] = decrypt_field(company_data["phone"])
    if company_data.get("email"):
        company_data["email"] = decrypt_field(company_data["email"])
    return company_data

# Get all companies (Super Admin only)
@api_router.get("/companies", tags=["Companies"])
async def get_companies(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can view all companies")
    
    companies = await db.companies.find({}, {"_id": 0}).to_list(1000)
    for c in companies:
        if c.get("phone"):
            c["phone"] = decrypt_field(c["phone"])
        if c.get("email"):
            c["email"] = decrypt_field(c["email"])
    
    # Get stats
    stats = {
        "total": len(companies),
        "active": len([c for c in companies if c.get("subscription_status") == "active"]),
        "trial": len([c for c in companies if c.get("subscription_status") == "trial"]),
        "expired": len([c for c in companies if c.get("subscription_status") == "expired"]),
        "expiring_soon": len([c for c in companies if c.get("subscription_end_date") and datetime.fromisoformat(c["subscription_end_date"].replace("Z", "+00:00")) < datetime.now(timezone.utc) + timedelta(days=7)])
    }
    
    return {"companies": companies, "stats": stats}

# Get single company
@api_router.get("/companies/{company_id}", tags=["Companies"])
async def get_company(company_id: str, current_user: dict = Depends(get_current_user)):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Check permission
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if company.get("phone"):
        company["phone"] = decrypt_field(company["phone"])
    if company.get("email"):
        company["email"] = decrypt_field(company["email"])
    return company

# Fields company_admin is allowed to update (profile/branding only). Super_admin can update any.
COMPANY_SAFE_UPDATE_FIELDS = frozenset({
    "name", "name_ar", "email", "phone", "address", "address_ar",
    "logo_base64", "website", "updated_at",
    "print_clinic_name", "print_header_invoice", "print_header_prescription",
    "print_header_consent", "print_footer", "print_primary_color", "print_logo_url",
    "print_default_printer", "print_invoice_name_ar", "print_invoice_name_en",
    "print_invoice_address", "print_invoice_phone", "print_invoice_email",
    "print_invoice_tax_number", "print_show_logo",
    "mfa_required",
})

# ==================== ADMIN SYSTEM SETTINGS (Super Admin only) ====================
SYSTEM_SETTINGS_ID = "main"

@api_router.get("/admin/system-settings", tags=["Admin"])
async def get_system_settings(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can view system settings")
    doc = await db.system_settings.find_one({"id": SYSTEM_SETTINGS_ID}, {"_id": 0})
    if not doc:
        return {"mfa_enabled": False}
    return {"mfa_enabled": doc.get("mfa_enabled", False)}

@api_router.put("/admin/system-settings", tags=["Admin"])
async def update_system_settings(updates: dict, request: Request, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can update system settings")
    mfa_enabled = updates.get("mfa_enabled")
    if mfa_enabled is None:
        raise HTTPException(status_code=400, detail="mfa_enabled is required")
    await db.system_settings.update_one(
        {"id": SYSTEM_SETTINGS_ID},
        {"$set": {"id": SYSTEM_SETTINGS_ID, "mfa_enabled": bool(mfa_enabled), "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    await log_audit("update", "system_settings", user=current_user, details={"mfa_enabled": bool(mfa_enabled)}, request=request)
    return {"mfa_enabled": bool(mfa_enabled)}

@api_router.get("/settings/mfa-allowed", tags=["Settings"])
async def get_mfa_allowed(current_user: dict = Depends(get_current_user)):
    """Read-only: whether 2FA is enabled at system level (for company admin UI)."""
    doc = await db.system_settings.find_one({"id": SYSTEM_SETTINGS_ID}, {"_id": 0, "mfa_enabled": 1})
    return {"mfa_enabled": doc.get("mfa_enabled", False) if doc else False}

# Update company
@api_router.put("/companies/{company_id}", tags=["Companies"])
async def update_company(company_id: str, updates: dict, request: Request, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Remove protected fields
    updates.pop("id", None)
    updates.pop("_id", None)
    updates.pop("created_at", None)
    
    # company_admin may only update safe profile/branding fields (not subscription, limits, features, is_active, code)
    if current_user.get("role") != "super_admin":
        updates = {k: v for k, v in updates.items() if k in COMPANY_SAFE_UPDATE_FIELDS}
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if updates.get("phone") is not None:
        updates["phone"] = encrypt_field(updates["phone"]) if updates.get("phone") else updates["phone"]
    if updates.get("email") is not None:
        updates["email"] = encrypt_field(updates["email"]) if updates.get("email") else updates["email"]
    
    await db.companies.update_one({"id": company_id}, {"$set": updates})
    invalidate_pattern("api:public/")
    invalidate_pattern("api:companies/")
    await log_audit("update", "company", resource_id=company_id, user=current_user, request=request)

    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if company.get("phone"):
        company["phone"] = decrypt_field(company["phone"])
    if company.get("email"):
        company["email"] = decrypt_field(company["email"])
    return company

# Update company subscription (Super Admin only)
@api_router.put("/companies/{company_id}/subscription", tags=["Companies"])
async def update_company_subscription(
    company_id: str, 
    status: str,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can update subscriptions")
    
    updates = {"subscription_status": status}
    if end_date:
        updates["subscription_end_date"] = end_date
    
    await db.companies.update_one({"id": company_id}, {"$set": updates})
    return {"message": "Subscription updated"}

# Update company limits (Super Admin only)
@api_router.put("/companies/{company_id}/limits", tags=["Companies"])
async def update_company_limits(
    company_id: str,
    max_users: Optional[int] = None,
    max_patients: Optional[int] = None,
    max_storage_mb: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can update limits")
    
    updates = {}
    if max_users is not None:
        updates["max_users"] = max_users
    if max_patients is not None:
        updates["max_patients"] = max_patients
    if max_storage_mb is not None:
        updates["max_storage_mb"] = max_storage_mb
    
    if updates:
        await db.companies.update_one({"id": company_id}, {"$set": updates})
    
    return {"message": "Limits updated"}

# Update company features (Super Admin only)
@api_router.put("/companies/{company_id}/features", tags=["Companies"])
async def update_company_features(company_id: str, features: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can update features")
    
    await db.companies.update_one({"id": company_id}, {"$set": {"features": features}})
    return {"message": "Features updated"}

# ==================== STAFF MANAGEMENT ====================

# Clinic dashboard stats (for company admin)
@api_router.get("/companies/{company_id}/dashboard-stats", tags=["Companies"])
async def get_company_dashboard_stats(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    cache_key = _make_key("api", f"companies/{company_id}/dashboard-stats")
    cached = get_cached(cache_key)
    if cached is not None:
        return cached
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    base = {"company_id": company_id}
    today_bookings = await db.online_bookings.count_documents({**base, "date": today, "status": {"$nin": ["cancelled"]}})
    total_patients = await db.patients.count_documents(base)
    total_appointments = await db.appointments.count_documents(base)
    today_appointments = await db.appointments.count_documents({**base, "date": today, "status": {"$ne": "cancelled"}})
    invoices = await db.invoices.find({**base, "payment_status": {"$in": ["paid", "partial"]}}, {"paid_amount": 1}).to_list(10000)
    revenue = sum(inv.get("paid_amount", 0) for inv in invoices)
    pending_invoices = await db.invoices.count_documents({**base, "payment_status": {"$in": ["pending", "partial"]}})
    result = {
        "today_online_bookings": today_bookings,
        "total_patients": total_patients,
        "total_appointments": total_appointments,
        "today_appointments": today_appointments,
        "revenue": round(revenue, 2),
        "pending_invoices": pending_invoices,
    }
    set_cached(cache_key, result, _DASHBOARD_TTL)
    return result


# Clinic reports (weekly / monthly)
@api_router.get("/companies/{company_id}/reports", tags=["Companies"])
async def get_company_reports(
    company_id: str,
    period: str = "month",
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    base = {"company_id": company_id}
    now = datetime.now(timezone.utc)
    if period == "week":
        start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    else:
        start = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    end = now.strftime("%Y-%m-%d")
    bookings = await db.online_bookings.find(
        {**base, "date": {"$gte": start, "$lte": end}, "status": {"$ne": "cancelled"}},
        {"date": 1, "status": 1},
    ).to_list(5000)
    invoices = await db.invoices.find(
        {**base, "payment_status": {"$in": ["paid", "partial"]}},
        {"created_at": 1, "paid_amount": 1},
    ).to_list(10000)
    by_date = {}
    for b in bookings:
        d = b.get("date", "")[:10]
        if d not in by_date:
            by_date[d] = {"bookings": 0, "revenue": 0}
        by_date[d]["bookings"] = by_date[d]["bookings"] + 1
    for inv in invoices:
        created = inv.get("created_at", "")
        if isinstance(created, str) and created:
            d = created[:10]
        else:
            continue
        if start <= d <= end:
            if d not in by_date:
                by_date[d] = {"bookings": 0, "revenue": 0}
            by_date[d]["revenue"] = by_date[d]["revenue"] + inv.get("paid_amount", 0)
    series = [{"date": d, **v} for d, v in sorted(by_date.items())]
    return {"period": period, "start": start, "end": end, "series": series}


# Get company staff
@api_router.get("/companies/{company_id}/staff", tags=["Companies"])
async def get_company_staff(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    staff = await db.users.find({"company_id": company_id}, {"_id": 0, "password": 0}).to_list(1000)
    for s in staff:
        if s.get("phone"):
            s["phone"] = decrypt_field(s["phone"])
    return {"staff": staff}

# Add staff member
@api_router.post("/companies/{company_id}/staff", tags=["Companies"])
async def add_staff_member(company_id: str, staff: StaffCreate, request: Request, current_user: dict = Depends(get_current_user)):
    # Check permission
    if current_user.get("role") not in ["super_admin", "company_admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.get("role") == "company_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check company limits
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    staff_count = await db.users.count_documents({"company_id": company_id})
    if staff_count >= company.get("max_users", 5):
        raise HTTPException(status_code=400, detail="Staff limit reached")
    
    # Check email
    existing = await db.users.find_one({"email": staff.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Create staff
    new_id = str(uuid.uuid4())
    staff_data = {
        "id": new_id,
        "email": staff.email,
        "password": hash_password(staff.password),
        "name": staff.name,
        "name_ar": staff.name_ar,
        "role": staff.role,
        "company_id": company_id,
        "phone": staff.phone,
        "specialty": staff.specialty,
        "specialty_ar": staff.specialty_ar,
        "bio": staff.bio,
        "bio_ar": staff.bio_ar,
        "photo_base64": staff.photo_base64,
        "consultation_fee": staff.consultation_fee,
        "working_hours": staff.working_hours,
        "is_available_online": staff.is_available_online,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    if staff_data.get("phone"):
        staff_data["phone"] = encrypt_field(staff_data["phone"])
    await db.users.insert_one(staff_data)
    invalidate_pattern("api:public/")
    invalidate_pattern("api:companies/")

    # Update company staff count
    await db.companies.update_one({"id": company_id}, {"$inc": {"users_count": 1}})

    await log_audit("create", "staff", resource_id=new_id, user=current_user, request=request)
    staff_data.pop("password", None)
    staff_data.pop("_id", None)
    if staff_data.get("phone"):
        staff_data["phone"] = decrypt_field(staff_data["phone"])
    return staff_data

# Update staff member
@api_router.put("/companies/{company_id}/staff/{staff_id}", tags=["Companies"])
async def update_staff_member(company_id: str, staff_id: str, updates: dict, request: Request, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["super_admin", "company_admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Remove protected fields
    updates.pop("id", None)
    updates.pop("_id", None)
    updates.pop("password", None)
    updates.pop("company_id", None)
    if updates.get("phone") is not None:
        updates["phone"] = encrypt_field(updates["phone"]) if updates.get("phone") else updates["phone"]
    
    await db.users.update_one({"id": staff_id, "company_id": company_id}, {"$set": updates})
    invalidate_pattern("api:public/")
    invalidate_pattern("api:companies/")
    await log_audit("update", "staff", resource_id=staff_id, user=current_user, request=request)

    staff = await db.users.find_one({"id": staff_id}, {"_id": 0, "password": 0})
    if staff and staff.get("phone"):
        staff["phone"] = decrypt_field(staff["phone"])
    return staff

# Delete staff member
@api_router.delete("/companies/{company_id}/staff/{staff_id}", tags=["Companies"])
async def delete_staff_member(company_id: str, staff_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["super_admin", "company_admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.users.delete_one({"id": staff_id, "company_id": company_id})
    if result.deleted_count > 0:
        invalidate_pattern("api:public/")
        invalidate_pattern("api:companies/")
        await db.companies.update_one({"id": company_id}, {"$inc": {"users_count": -1}})
        await log_audit("delete", "staff", resource_id=staff_id, user=current_user, request=request)
    
    return {"message": "Staff member deleted"}

# ==================== COMPANY BACKUP ====================

# Get company backups
@api_router.get("/companies/{company_id}/backups", tags=["Companies"])
async def get_company_backups(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Exclude 'data' field from list response (too large, only needed for restore)
    backups = await db.company_backups.find(
        {"company_id": company_id},
        {"_id": 0, "data": 0, "data_encrypted": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"backups": backups}

# Create company backup
@api_router.post("/companies/{company_id}/backups", tags=["Companies"])
async def create_company_backup(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # Get company data
        company = await db.companies.find_one({"id": company_id}, {"_id": 0})
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        
        # Get all related data
        patients = await db.patients.find({"company_id": company_id}, {"_id": 0}).to_list(10000)
        appointments = await db.appointments.find({"company_id": company_id}, {"_id": 0}).to_list(10000)
        invoices = await db.invoices.find({"company_id": company_id}, {"_id": 0}).to_list(10000)
        visits = await db.visits.find({"company_id": company_id}, {"_id": 0}).to_list(10000)
        bookings = await db.online_bookings.find({"company_id": company_id}, {"_id": 0}).to_list(10000)
        staff = await db.users.find({"company_id": company_id}, {"_id": 0, "password": 0}).to_list(100)
        notification_settings = await db.notification_settings.find_one({"company_id": company_id}, {"_id": 0})
        
        # Calculate approximate size
        import json
        backup_data = {
            "company": company,
            "patients": patients,
            "appointments": appointments,
            "invoices": invoices,
            "visits": visits,
            "bookings": bookings,
            "staff": staff,
            "notification_settings": notification_settings
        }
        data_str = json.dumps(backup_data, default=str)
        size_bytes = len(data_str.encode('utf-8'))
        size_mb = round(size_bytes / (1024 * 1024), 2)
        data_encrypted = encrypt_field(data_str)
        if not data_encrypted or data_encrypted == data_str:
            data_encrypted = None
        backup = {
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "data_encrypted": data_encrypted,
            "data": backup_data if not data_encrypted else None,
            "size": f"{size_mb} MB" if size_mb >= 1 else f"{round(size_bytes/1024, 1)} KB",
            "status": "success",
            "type": "manual",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user.get("id"),
            "patients_count": len(patients),
            "appointments_count": len(appointments),
            "invoices_count": len(invoices)
        }
        if backup.get("data") is None:
            backup.pop("data", None)
        await db.company_backups.insert_one(backup)
        backup.pop("data", None)
        backup.pop("data_encrypted", None)
        backup.pop("_id", None)
        return backup
        
    except Exception as e:
        logger.error(f"Backup creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Restore company backup
@api_router.post("/companies/{company_id}/backups/{backup_id}/restore", tags=["Companies"])
async def restore_company_backup(company_id: str, backup_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only super admin can restore backups")
    
    try:
        # Get backup
        backup = await db.company_backups.find_one({"id": backup_id, "company_id": company_id})
        if not backup:
            raise HTTPException(status_code=404, detail="Backup not found")
        enc = backup.get("data_encrypted")
        if enc:
            data_str = decrypt_field(enc)
            data = json.loads(data_str) if data_str else {}
        else:
            data = backup.get("data", {})
        if not data:
            raise HTTPException(status_code=400, detail="Backup data is empty")
        
        # Restore data (replace existing)
        if data.get("patients"):
            await db.patients.delete_many({"company_id": company_id})
            if len(data["patients"]) > 0:
                await db.patients.insert_many(data["patients"])
        
        if data.get("appointments"):
            await db.appointments.delete_many({"company_id": company_id})
            if len(data["appointments"]) > 0:
                await db.appointments.insert_many(data["appointments"])
        
        if data.get("invoices"):
            await db.invoices.delete_many({"company_id": company_id})
            if len(data["invoices"]) > 0:
                await db.invoices.insert_many(data["invoices"])
        
        if data.get("visits"):
            await db.visits.delete_many({"company_id": company_id})
            if len(data["visits"]) > 0:
                await db.visits.insert_many(data["visits"])
        
        if data.get("bookings"):
            await db.online_bookings.delete_many({"company_id": company_id})
            if len(data["bookings"]) > 0:
                await db.online_bookings.insert_many(data["bookings"])
        
        if data.get("notification_settings"):
            await db.notification_settings.update_one(
                {"company_id": company_id},
                {"$set": data["notification_settings"]},
                upsert=True
            )
        
        # Log restore action
        logger.info(f"Backup {backup_id} restored for company {company_id} by {current_user.get('email')}")
        
        return {"message": "Backup restored successfully"}
        
    except Exception as e:
        logger.error(f"Backup restore error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Delete company backup
@api_router.delete("/companies/{company_id}/backups/{backup_id}", tags=["Companies"])
async def delete_company_backup(company_id: str, backup_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.company_backups.delete_one({"id": backup_id, "company_id": company_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Backup not found")
    
    return {"message": "Backup deleted"}

# ==================== COMPANY NOTIFICATION SETTINGS ====================

# Get company notification settings (never return raw openai_api_key)
@api_router.get("/companies/{company_id}/notification-settings", tags=["Companies"])
async def get_company_notification_settings(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    settings = await db.notification_settings.find_one({"company_id": company_id}, {"_id": 0})
    if settings:
        # Mask auth token for security
        if settings.get("twilio_auth_token"):
            settings["twilio_auth_token"] = "••••••••"
        # Never return raw AI key; expose only that it is set and connection status
        if settings.get("openai_api_key"):
            settings["openai_api_key_set"] = True
            del settings["openai_api_key"]
        else:
            settings["openai_api_key_set"] = False
        settings.setdefault("ai_connected", False)
        settings.setdefault("ai_provider", "openai")
    return settings or {}

# Save company notification settings (openai_api_key is saved only via test-ai endpoint)
@api_router.post("/companies/{company_id}/notification-settings", tags=["Companies"])
async def save_company_notification_settings(company_id: str, settings: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Don't overwrite auth token if it's masked
    if settings.get("twilio_auth_token") and "•" in str(settings.get("twilio_auth_token", "")):
        del settings["twilio_auth_token"]
    # Never overwrite AI key/provider from this endpoint (only test-ai sets them)
    settings.pop("openai_api_key", None)
    settings.pop("openai_api_key_set", None)
    settings.pop("ai_connected", None)
    settings.pop("ai_provider", None)
    
    settings["company_id"] = company_id
    settings["updated_at"] = datetime.now(timezone.utc).isoformat()
    settings["updated_by"] = current_user.get("id")
    
    await db.notification_settings.update_one(
        {"company_id": company_id},
        {"$set": settings},
        upsert=True
    )
    
    return {"message": "Settings saved"}


# Print template settings: merge company info + notification_settings print_* for invoices, prescriptions, consents
@api_router.get("/companies/{company_id}/print-settings", tags=["Companies"])
async def get_company_print_settings(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "name": 1, "name_ar": 1, "logo_base64": 1, "address": 1, "address_ar": 1, "phone": 1, "email": 1})
    settings = await db.notification_settings.find_one({"company_id": company_id}, {"_id": 0})
    company = company or {}
    if company.get("phone"):
        company["phone"] = decrypt_field(company["phone"]) or company.get("phone")
    if company.get("email"):
        company["email"] = decrypt_field(company["email"]) or company.get("email")
    st = settings or {}
    out = {
        "company_name": company.get("name") or "",
        "company_name_ar": company.get("name_ar") or company.get("name") or "",
        "logo_base64": company.get("logo_base64") or "",
        "print_clinic_name": st.get("print_clinic_name") or "",
        "print_header_invoice": st.get("print_header_invoice") or "",
        "print_header_prescription": st.get("print_header_prescription") or "",
        "print_header_consent": st.get("print_header_consent") or "",
        "print_footer": st.get("print_footer") or "",
        "print_primary_color": st.get("print_primary_color") or "#0d9488",
        "print_logo_url": st.get("print_logo_url") or "",
        "print_default_printer": st.get("print_default_printer") or "",
        "print_invoice_name_ar": st.get("print_invoice_name_ar") or company.get("name_ar") or company.get("name") or "",
        "print_invoice_name_en": st.get("print_invoice_name_en") or company.get("name") or company.get("name_ar") or "",
        "print_invoice_address": st.get("print_invoice_address") or company.get("address") or company.get("address_ar") or "",
        "print_invoice_phone": st.get("print_invoice_phone") or company.get("phone") or "",
        "print_invoice_email": st.get("print_invoice_email") or company.get("email") or "",
        "print_invoice_tax_number": st.get("print_invoice_tax_number") or "",
        "print_show_logo": st.get("print_show_logo", True),
    }
    return out


def _get_windows_printers() -> List[str]:
    """Return list of printer names on Windows. Empty list on non-Windows or on error."""
    if sys.platform != "win32":
        return []
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"],
            capture_output=True,
            text=True,
            timeout=10,
            creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
        )
        if result.returncode != 0 or not result.stdout:
            return []
        names = [n.strip() for n in result.stdout.strip().splitlines() if n.strip()]
        return names
    except Exception:
        return []


@api_router.get("/companies/{company_id}/printers", tags=["Companies"])
async def get_company_printers(company_id: str, current_user: dict = Depends(get_current_user)):
    """Return list of printers available on the server (Windows). Empty if server is not Windows."""
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    printers = _get_windows_printers()
    return {"printers": printers}


# Test company notification connection
@api_router.post("/companies/{company_id}/test-notification", tags=["Companies"])
async def test_company_notification(company_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    notification_type = request.get("type", "sms")
    
    # Get settings
    settings = await db.notification_settings.find_one({"company_id": company_id})
    
    if not settings:
        raise HTTPException(status_code=400, detail="الإعدادات غير موجودة - يرجى حفظ الإعدادات أولاً")
    
    if not settings.get("twilio_account_sid") or not settings.get("twilio_auth_token"):
        raise HTTPException(status_code=400, detail="بيانات Twilio غير مكتملة - تأكد من إدخال Account SID و Auth Token")
    
    try:
        from twilio.rest import Client
        
        client = Client(settings["twilio_account_sid"], settings["twilio_auth_token"])
        
        # Just verify the account by fetching account info
        account = client.api.accounts(settings["twilio_account_sid"]).fetch()
        
        if notification_type == "sms":
            # Mark as connected
            await db.notification_settings.update_one(
                {"company_id": company_id},
                {"$set": {"sms_connected": True, "sms_enabled": True}}
            )
            return {"success": True, "message": "تم ربط SMS بنجاح!"}
        elif notification_type == "whatsapp":
            await db.notification_settings.update_one(
                {"company_id": company_id},
                {"$set": {"whatsapp_connected": True, "whatsapp_enabled": True}}
            )
            return {"success": True, "message": "تم ربط WhatsApp بنجاح!"}
        
        return {"success": True}
    
    except Exception as e:
        error_msg = str(e)
        if "authenticate" in error_msg.lower():
            error_msg = "فشل المصادقة - تأكد من صحة Account SID و Auth Token"
        logger.error(f"Notification connection error: {str(e)}")
        return {"success": False, "error": error_msg}


class TestAIRequest(BaseModel):
    openai_api_key: str
    provider: str = "openai"  # openai | gemini


def _test_gemini_key_sync(api_key: str) -> None:
    """Validate Gemini API key with a minimal request. Raises on failure."""
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FutureWarning)
        import google.generativeai as genai
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content("ok", generation_config=genai.GenerationConfig(max_output_tokens=5))
    if not response or not response.text:
        raise ValueError("Empty Gemini response")


@api_router.post("/companies/{company_id}/test-ai", tags=["Companies"])
async def test_and_save_ai_key(company_id: str, body: TestAIRequest, current_user: dict = Depends(get_current_user)):
    """Test AI API key (OpenAI or Gemini) and save it for the clinic if valid. Clinic admin or super_admin only."""
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    api_key = (body.openai_api_key or "").strip()
    provider = (body.provider or "openai").strip().lower()
    if provider not in ("openai", "gemini"):
        return {"success": False, "error": "نوع المزود غير مدعوم (Provider not supported). استخدم OpenAI أو Gemini."}
    if not api_key:
        return {"success": False, "error": "أدخل مفتاح API (Enter API key)"}
    try:
        if provider == "openai":
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key)
            await client.chat.completions.create(model="gpt-4o", messages=[{"role": "user", "content": "ok"}], max_tokens=5)
        else:
            await asyncio.to_thread(_test_gemini_key_sync, api_key)
    except ImportError as e:
        err = str(e)
        if "google" in err.lower():
            err = "الحزمة غير مثبتة: ثبّت google-generativeai ثم شغّل السيرفر من نفس البيئة (venv). الأمر: pip install google-generativeai"
        logger.error(f"AI key test import error ({provider}): {e}")
        await db.notification_settings.update_one(
            {"company_id": company_id},
            {"$set": {"ai_connected": False, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        return {"success": False, "error": err}
    except Exception as e:
        err = str(e)
        if "invalid" in err.lower() or "api_key" in err.lower() or "auth" in err.lower() or "invalid_api_key" in err.lower():
            err = "مفتاح غير صالح أو منتهي الصلاحية (Invalid or expired API key)"
        elif "429" in err or "quota" in err.lower() or "insufficient_quota" in err.lower() or "resource_exhausted" in err.lower():
            err = "تجاوزت الحصة أو الرصيد. تحقق من الفوترة في حسابك (OpenAI أو Google AI Studio)."
        logger.error(f"AI key test error ({provider}): {e}")
        await db.notification_settings.update_one(
            {"company_id": company_id},
            {"$set": {"ai_connected": False, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        return {"success": False, "error": err}
    encrypted_key = encrypt_field(api_key)
    await db.notification_settings.update_one(
        {"company_id": company_id},
        {
            "$set": {
                "company_id": company_id,
                "openai_api_key": encrypted_key,
                "ai_provider": provider,
                "ai_connected": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user.get("id"),
            }
        },
        upsert=True
    )
    return {"success": True, "message": f"تم ربط مفتاح الذكاء الاصطناعي بنجاح ({'OpenAI' if provider == 'openai' else 'Gemini'})"}


# Trigger reminders manually (for testing)
@api_router.post("/companies/{company_id}/trigger-reminders", tags=["Companies"])
async def trigger_reminders(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        await process_auto_reminders()
        return {"message": "Reminders processed successfully"}
    except Exception as e:
        logger.error(f"Manual reminder trigger error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Send single reminder to a booking
@api_router.post("/bookings/{booking_id}/send-reminder", tags=["Companies"])
async def send_booking_reminder(booking_id: str, current_user: dict = Depends(get_current_user)):
    company_id = current_user.get("company_id")
    
    # Get booking
    booking = await db.online_bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check access
    if current_user.get("role") != "super_admin" and booking.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get notification settings
    settings = await db.notification_settings.find_one({"company_id": booking.get("company_id")})
    if not settings:
        raise HTTPException(status_code=400, detail="Notification settings not configured")
    
    # Get company
    company = await db.companies.find_one({"id": booking.get("company_id")})
    
    # Send reminder
    success = await send_reminder_message(settings, booking, company)
    
    if success:
        await db.online_bookings.update_one(
            {"id": booking_id},
            {"$set": {"reminder_sent": True, "reminder_sent_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": True, "message": "Reminder sent successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send reminder")

# ==================== ONLINE BOOKING (PUBLIC) ====================

# Generate doctor slug from name
def generate_slug(name: str) -> str:
    import re
    # Convert Arabic to English-friendly slug
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_-]+', '-', slug)
    slug = re.sub(r'^-+|-+$', '', slug)
    return slug or "doctor"

# Get doctor public profile by ID or slug (PUBLIC)
@api_router.get("/public/doctor/{identifier}", tags=["Public"])
async def get_doctor_profile(identifier: str):
    """Get doctor full profile by ID or slug for public profile page"""
    # Try to find by ID first
    doctor = await db.users.find_one({"id": identifier}, {"_id": 0, "password": 0, "email": 0})
    
    # If not found, try by slug
    if not doctor:
        doctor = await db.users.find_one({"slug": identifier}, {"_id": 0, "password": 0, "email": 0})
    
    # If still not found, try partial name match
    if not doctor:
        doctors = await db.users.find({
            "$or": [
                {"name": {"$regex": identifier, "$options": "i"}},
                {"name_ar": {"$regex": identifier, "$options": "i"}}
            ],
            "role": {"$in": ["doctor", "company_admin"]}
        }, {"_id": 0, "password": 0}).to_list(1)
        if doctors:
            doctor = doctors[0]
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Get company info
    company = None
    if doctor.get("company_id"):
        company = await db.companies.find_one({"id": doctor["company_id"]}, {"_id": 0})
    
    # Get reviews
    reviews = await db.doctor_reviews.find(
        {"doctor_id": doctor["id"], "is_visible": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Calculate average rating
    avg_rating = 0
    review_count = len(reviews)
    if review_count > 0:
        avg_rating = sum(r["rating"] for r in reviews) / review_count
    
    # Generate share URL
    slug = doctor.get("slug") or generate_slug(doctor.get("name", "doctor"))
    
    return {
        "doctor": {
            **doctor,
            "slug": slug
        },
        "company": company,
        "reviews": reviews,
        "stats": {
            "average_rating": round(avg_rating, 1),
            "review_count": review_count
        }
    }

# Get company by code (PUBLIC - for booking page per clinic)
@api_router.get("/public/companies/by-code/{code}", tags=["Public"])
async def get_company_by_code(code: str):
    cache_key = _make_key("api", f"public/companies/by-code/{code}")
    cached = get_cached(cache_key)
    if cached is not None:
        return cached
    company = await db.companies.find_one(
        {"code": code, "is_active": True},
        {"_id": 0, "id": 1, "name": 1, "name_ar": 1, "code": 1, "address": 1, "address_ar": 1, "phone": 1, "logo_base64": 1, "website": 1}
    )
    if not company:
        raise HTTPException(status_code=404, detail="Clinic not found")
    if company.get("phone"):
        company["phone"] = decrypt_field(company["phone"])
    set_cached(cache_key, company, _DEFAULT_TTL)
    return company


# Get available doctors for online booking (PUBLIC - no auth required)
@api_router.get("/public/doctors", tags=["Public"])
async def get_public_doctors(specialty: Optional[str] = None, company_code: Optional[str] = None):
    cache_key = _make_key("api", "public/doctors", {"specialty": specialty, "company_code": company_code})
    cached = get_cached(cache_key)
    if cached is not None:
        return cached
    query = {"is_available_online": True, "role": {"$in": ["doctor", "company_admin"]}}
    if specialty:
        query["specialty"] = specialty
    if company_code:
        company = await db.companies.find_one({"code": company_code, "is_active": True}, {"id": 1})
        if not company:
            return {"doctors": []}
        query["company_id"] = company["id"]

    doctors = await db.users.find(query, {
        "_id": 0, "password": 0, "email": 0
    }).to_list(1000)

    # Get company info for each doctor
    for doc in doctors:
        if doc.get("company_id"):
            company = await db.companies.find_one({"id": doc["company_id"]}, {"_id": 0, "name": 1, "name_ar": 1, "address": 1, "address_ar": 1, "phone": 1})
            doc["company"] = company
        doc["company_name"] = doc.get("company", {}).get("name_ar") or doc.get("company", {}).get("name")

    result = {"doctors": doctors}
    set_cached(cache_key, result, _DEFAULT_TTL)
    return result

# Get doctor available slots (PUBLIC)
@api_router.get("/public/doctors/{doctor_id}/slots", tags=["Public"])
async def get_doctor_slots(doctor_id: str, date: str):
    doctor = await db.users.find_one({"id": doctor_id}, {"_id": 0, "password": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Get working hours
    working_hours = doctor.get("working_hours", {})
    day_name = datetime.strptime(date, "%Y-%m-%d").strftime("%A").lower()
    day_hours = working_hours.get(day_name, {"start": "09:00", "end": "17:00"})
    
    # Generate time slots
    start_hour = int(day_hours.get("start", "09:00").split(":")[0])
    end_hour = int(day_hours.get("end", "17:00").split(":")[0])
    
    all_slots = []
    for h in range(start_hour, end_hour):
        all_slots.append(f"{h:02d}:00")
        all_slots.append(f"{h:02d}:30")
    
    # Get booked appointments
    booked = await db.appointments.find({
        "doctor_id": doctor_id,
        "date": date,
        "status": {"$ne": "cancelled"}
    }, {"time": 1}).to_list(100)
    
    booked_times = [b.get("time") for b in booked]
    
    # Also check online bookings
    online_booked = await db.online_bookings.find({
        "doctor_id": doctor_id,
        "date": date,
        "status": {"$ne": "cancelled"}
    }, {"time": 1}).to_list(100)
    
    booked_times.extend([b.get("time") for b in online_booked])
    
    available_slots = [s for s in all_slots if s not in booked_times]
    
    return {
        "doctor_id": doctor_id,
        "date": date,
        "available_slots": available_slots,
        "booked_slots": booked_times
    }

# Create online booking (PUBLIC)
@api_router.post("/public/book", tags=["Public"])
async def create_online_booking(booking: OnlineBookingBase):
    # Validate doctor exists
    doctor = await db.users.find_one({"id": booking.doctor_id})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Check slot availability
    existing = await db.online_bookings.find_one({
        "doctor_id": booking.doctor_id,
        "date": booking.date,
        "time": booking.time,
        "status": {"$ne": "cancelled"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="This slot is already booked")
    
    # Create booking
    booking_data = {
        "id": str(uuid.uuid4()),
        "patient_name": booking.patient_name,
        "patient_phone": booking.patient_phone,
        "patient_email": booking.patient_email,
        "doctor_id": booking.doctor_id,
        "company_id": booking.company_id,
        "date": booking.date,
        "time": booking.time,
        "reason": booking.reason,
        "notes": booking.notes,
        "status": "scheduled",
        "confirmation_code": str(uuid.uuid4())[:8].upper(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await send_booking_notification(booking_data, "created")
    if booking_data.get("patient_phone"):
        booking_data["patient_phone"] = encrypt_field(booking_data["patient_phone"])
    if booking_data.get("patient_email"):
        booking_data["patient_email"] = encrypt_field(booking_data["patient_email"])
    await db.online_bookings.insert_one(booking_data)
    await create_notification(
        booking_data["company_id"],
        "new_booking",
        "حجز جديد / New booking",
        f"حجز جديد من {booking_data.get('patient_name', '')} - {booking_data.get('date', '')} {booking_data.get('time', '')}",
        link="/clinic-admin",
    )
    booking_data.pop("_id", None)
    booking_data["patient_phone"] = decrypt_field(booking_data.get("patient_phone"))
    booking_data["patient_email"] = decrypt_field(booking_data.get("patient_email"))
    return booking_data

# Get booking by confirmation code (PUBLIC)
@api_router.get("/public/booking/{confirmation_code}", tags=["Public"])
async def get_booking_by_code(confirmation_code: str):
    booking = await db.online_bookings.find_one({"confirmation_code": confirmation_code.upper()}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get doctor info
    doctor = await db.users.find_one({"id": booking.get("doctor_id")}, {"_id": 0, "password": 0, "email": 0})
    booking["doctor"] = doctor
    if booking.get("patient_phone"):
        booking["patient_phone"] = decrypt_field(booking["patient_phone"])
    if booking.get("patient_email"):
        booking["patient_email"] = decrypt_field(booking["patient_email"])
    return booking

# Cancel booking (PUBLIC)
@api_router.post("/public/booking/{confirmation_code}/cancel", tags=["Public"])
async def cancel_booking(confirmation_code: str):
    result = await db.online_bookings.update_one(
        {"confirmation_code": confirmation_code.upper()},
        {"$set": {"status": "cancelled"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return {"message": "Booking cancelled"}


# ==================== PATIENT PORTAL ====================
# Staff creates one-time link; patient uses link to get JWT and access their data.

@api_router.post("/patients/{patient_id}/portal-invite", tags=["Portal"])
async def create_portal_invite(patient_id: str, current_user: dict = Depends(get_current_user)):
    """Create a one-time portal access link for the patient. Staff only."""
    patient = await db.patients.find_one({"id": patient_id}, {"_id": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    company_id = current_user.get("company_id")
    if current_user.get("role") != "super_admin" and patient.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    one_time_token = str(uuid.uuid4()).replace("-", "")[:16]
    doc = {
        "token": one_time_token,
        "patient_id": patient_id,
        "company_id": patient.get("company_id") or company_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "used_at": None,
    }
    await db.patient_portal_tokens.insert_one(doc)
    base_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    link = f"{base_url}/portal?token={one_time_token}"
    sent_sms_whatsapp = False
    patient_phone = decrypt_field(patient.get("phone")) or patient.get("phone") or ""
    if patient_phone and len(patient_phone) >= 8:
        settings = await db.notification_settings.find_one({"company_id": patient.get("company_id") or company_id})
        if settings:
            msg = f"رابط بوابة المريض (صالح 7 أيام): {link}"
            sent_sms_whatsapp = await send_patient_sms_whatsapp(settings, patient_phone, msg)
    return {"link": link, "expires_in_days": 7, "sent_sms_whatsapp": sent_sms_whatsapp}


@api_router.get("/portal/login", tags=["Portal"])
async def portal_login(token: str):
    """Exchange one-time token for portal JWT. Public."""
    doc = await db.patient_portal_tokens.find_one({"token": token.strip()})
    if not doc:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    if doc.get("used_at"):
        raise HTTPException(status_code=400, detail="This link has already been used")
    expires = datetime.fromisoformat(doc["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="Link expired")
    await db.patient_portal_tokens.update_one(
        {"token": doc["token"]},
        {"$set": {"used_at": datetime.now(timezone.utc).isoformat()}},
    )
    jwt_token = create_portal_token(patient_id=doc["patient_id"], company_id=doc["company_id"])
    patient = await db.patients.find_one({"id": doc["patient_id"]}, {"_id": 0, "name": 1, "name_ar": 1})
    return {"access_token": jwt_token, "patient_name": patient.get("name_ar") or patient.get("name", "")}


@api_router.get("/portal/me", tags=["Portal"])
async def portal_me(portal_user: dict = Depends(get_portal_user)):
    """Portal: current patient summary (safe fields only)."""
    patient = await db.patients.find_one(
        {"id": portal_user["patient_id"], "company_id": portal_user["company_id"]},
        {"_id": 0, "id": 1, "name": 1, "name_ar": 1, "date_of_birth": 1, "gender": 1, "blood_type": 1},
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@api_router.get("/portal/visits", tags=["Portal"])
async def portal_visits(portal_user: dict = Depends(get_portal_user)):
    """Portal: list of visits (summaries). doctor_notes and pharmacy are excluded from patient view."""
    visits = await db.visits.find(
        {"patient_id": portal_user["patient_id"]},
        {"_id": 0, "created_at": 1, "reason": 1, "diagnosis": 1, "notes": 1, "prescription": 1},
    ).sort("created_at", -1).to_list(50)
    for v in visits:
        if isinstance(v.get("created_at"), datetime):
            v["created_at"] = v["created_at"].isoformat()
        # Ensure doctor_notes and pharmacy are never sent to portal
        v.pop("doctor_notes", None)
        v.pop("pharmacy", None)
    return {"visits": visits}


@api_router.get("/portal/invoices", tags=["Portal"])
async def portal_invoices(portal_user: dict = Depends(get_portal_user)):
    """Portal: list of invoices (balance and status)."""
    invoices = await db.invoices.find(
        {"patient_id": portal_user["patient_id"]},
        {"_id": 0, "id": 1, "created_at": 1, "total": 1, "paid_amount": 1, "payment_status": 1},
    ).sort("created_at", -1).to_list(50)
    for inv in invoices:
        if isinstance(inv.get("created_at"), datetime):
            inv["created_at"] = inv["created_at"].isoformat()
    return {"invoices": invoices}


@api_router.get("/portal/messages", tags=["Portal"])
async def portal_messages(portal_user: dict = Depends(get_portal_user)):
    """Portal: messages from clinic to patient."""
    messages = await db.patient_messages.find(
        {"patient_id": portal_user["patient_id"], "company_id": portal_user["company_id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)
    for m in messages:
        if isinstance(m.get("created_at"), datetime):
            m["created_at"] = m["created_at"].isoformat()
    return {"messages": messages}


class PortalMessageCreate(BaseModel):
    message: str


@api_router.post("/portal/messages", tags=["Portal"])
async def portal_send_message(body: PortalMessageCreate, portal_user: dict = Depends(get_portal_user)):
    """Portal: patient sends a message to the clinic."""
    doc = {
        "id": str(uuid.uuid4()),
        "patient_id": portal_user["patient_id"],
        "company_id": portal_user["company_id"],
        "direction": "patient_to_clinic",
        "body": body.message[:2000],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read_at": None,
    }
    await db.patient_messages.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.post("/patients/{patient_id}/messages", tags=["Portal"])
async def staff_send_message_to_patient(patient_id: str, body: PortalMessageCreate, current_user: dict = Depends(get_current_user)):
    """Staff sends a message to the patient (visible in patient portal)."""
    patient = await db.patients.find_one({"id": patient_id}, {"company_id": 1})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    company_id = current_user.get("company_id")
    if current_user.get("role") != "super_admin" and patient.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    doc = {
        "id": str(uuid.uuid4()),
        "patient_id": patient_id,
        "company_id": company_id,
        "direction": "clinic_to_patient",
        "body": body.message[:2000],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read_at": None,
    }
    await db.patient_messages.insert_one(doc)
    doc.pop("_id", None)
    return doc


# Get company online bookings
@api_router.get("/companies/{company_id}/online-bookings", tags=["Companies"])
async def get_company_online_bookings(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    bookings = await db.online_bookings.find({"company_id": company_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for b in bookings:
        if b.get("patient_phone"):
            b["patient_phone"] = decrypt_field(b["patient_phone"])
        if b.get("patient_email"):
            b["patient_email"] = decrypt_field(b["patient_email"])
    return {"bookings": bookings}


# Confirm online booking (protected)
@api_router.put("/online-bookings/{booking_id}/confirm", tags=["Companies"])
async def confirm_online_booking(booking_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    booking = await db.online_bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != booking.get("company_id"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.online_bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "confirmed", "confirmed_at": datetime.now(timezone.utc).isoformat(), "confirmed_by": current_user.get("id")}}
    )
    await log_audit("confirm", "online_booking", resource_id=booking_id, user=current_user, request=request)
    # Send notification
    booking["status"] = "confirmed"
    await send_booking_notification(booking, "confirmed")
    await create_notification(
        booking.get("company_id"),
        "booking_confirmed",
        "تم تأكيد حجز / Booking confirmed",
        f"تم تأكيد حجز {booking.get('patient_name', '')} - {booking.get('date', '')} {booking.get('time', '')}",
        link="/clinic-admin",
    )

    return {"message": "Booking confirmed", "status": "confirmed"}

# Cancel online booking (protected)
@api_router.put("/online-bookings/{booking_id}/cancel", tags=["Companies"])
async def cancel_online_booking_protected(booking_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    booking = await db.online_bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != booking.get("company_id"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.online_bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat(), "cancelled_by": current_user.get("id")}}
    )
    await log_audit("cancel", "online_booking", resource_id=booking_id, user=current_user, request=request)
    # Send notification
    booking["status"] = "cancelled"
    await send_booking_notification(booking, "cancelled")
    
    return {"message": "Booking cancelled", "status": "cancelled"}

# Complete online booking (protected)
@api_router.put("/online-bookings/{booking_id}/complete", tags=["Companies"])
async def complete_online_booking(booking_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    booking = await db.online_bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if current_user.get("role") != "super_admin" and current_user.get("company_id") != booking.get("company_id"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.online_bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    await log_audit("complete", "online_booking", resource_id=booking_id, user=current_user, request=request)
    return {"message": "Booking completed", "status": "completed"}


# ==================== DOCTOR REVIEWS & RATINGS ====================

class ReviewCreate(BaseModel):
    doctor_id: str
    patient_name: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    booking_code: Optional[str] = None  # To verify the patient actually visited

# Add review (PUBLIC)
@api_router.post("/public/reviews", tags=["Public"])
async def add_doctor_review(review: ReviewCreate):
    # Check if doctor exists
    doctor = await db.users.find_one({"id": review.doctor_id})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Verify booking if code provided
    is_verified = False
    if review.booking_code:
        booking = await db.online_bookings.find_one({
            "confirmation_code": review.booking_code.upper(),
            "doctor_id": review.doctor_id,
            "status": "completed"
        })
        if booking:
            is_verified = True
    
    review_doc = {
        "id": str(uuid.uuid4()),
        "doctor_id": review.doctor_id,
        "patient_name": review.patient_name,
        "rating": review.rating,
        "comment": review.comment,
        "is_verified": is_verified,
        "is_visible": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "doctor_reply": None,
        "doctor_reply_at": None
    }
    
    await db.doctor_reviews.insert_one(review_doc)
    review_doc.pop("_id", None)
    
    return {"message": "Review added successfully", "review": review_doc}

# Get doctor reviews (PUBLIC)
@api_router.get("/public/doctors/{doctor_id}/reviews", tags=["Public"])
async def get_doctor_reviews(doctor_id: str, limit: int = 20):
    reviews = await db.doctor_reviews.find(
        {"doctor_id": doctor_id, "is_visible": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Calculate stats
    total = len(reviews)
    avg_rating = sum(r["rating"] for r in reviews) / total if total > 0 else 0
    
    # Rating breakdown
    breakdown = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for r in reviews:
        breakdown[r["rating"]] = breakdown.get(r["rating"], 0) + 1
    
    return {
        "reviews": reviews,
        "stats": {
            "total": total,
            "average": round(avg_rating, 1),
            "breakdown": breakdown
        }
    }

# Doctor reply to review (Protected)
@api_router.put("/reviews/{review_id}/reply", tags=["Public"])
async def reply_to_review(review_id: str, reply: str = Form(...), current_user: dict = Depends(get_current_user)):
    review = await db.doctor_reviews.find_one({"id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Only the doctor who received the review can reply
    if current_user.get("id") != review.get("doctor_id") and current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.doctor_reviews.update_one(
        {"id": review_id},
        {"$set": {
            "doctor_reply": reply,
            "doctor_reply_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Reply added"}

# Hide/Show review (Admin only)
@api_router.put("/reviews/{review_id}/visibility", tags=["Public"])
async def toggle_review_visibility(review_id: str, visible: bool, current_user: dict = Depends(get_current_user)):
    review = await db.doctor_reviews.find_one({"id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Only the doctor, company admin or super admin can hide
    if current_user.get("role") not in ["super_admin", "company_admin"] and current_user.get("id") != review.get("doctor_id"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.doctor_reviews.update_one(
        {"id": review_id},
        {"$set": {"is_visible": visible}}
    )
    
    return {"message": f"Review {'shown' if visible else 'hidden'}"}


# ==================== AUDIT LOG ROUTES (routers/audit.py) ====================
from routers.audit import register_audit_routes
register_audit_routes(api_router)

# ==================== SUPER ADMIN DASHBOARD ====================

@api_router.get("/admin/dashboard", tags=["Companies"])
async def get_admin_dashboard(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get companies stats
    companies = await db.companies.find({}, {"_id": 0}).to_list(1000)
    
    total_companies = len(companies)
    active_companies = len([c for c in companies if c.get("subscription_status") == "active"])
    trial_companies = len([c for c in companies if c.get("subscription_status") == "trial"])
    expired_companies = len([c for c in companies if c.get("subscription_status") == "expired"])
    
    # Expiring soon (within 7 days)
    expiring_soon = []
    for c in companies:
        if c.get("subscription_end_date"):
            try:
                end_date = datetime.fromisoformat(c["subscription_end_date"].replace("Z", "+00:00"))
                if end_date < datetime.now(timezone.utc) + timedelta(days=7):
                    expiring_soon.append(c)
            except Exception:
                pass
    
    # Total stats
    total_users = await db.users.count_documents({})
    total_patients = await db.patients.count_documents({})
    total_appointments = await db.appointments.count_documents({})
    total_online_bookings = await db.online_bookings.count_documents({})
    
    # Recent companies
    recent_companies = sorted(companies, key=lambda x: x.get("created_at", ""), reverse=True)[:5]
    
    return {
        "companies": {
            "total": total_companies,
            "active": active_companies,
            "trial": trial_companies,
            "expired": expired_companies,
            "expiring_soon": len(expiring_soon)
        },
        "totals": {
            "users": total_users,
            "patients": total_patients,
            "appointments": total_appointments,
            "online_bookings": total_online_bookings
        },
        "expiring_soon": expiring_soon,
        "recent_companies": recent_companies
    }

# ==================== SEED DATA ====================

async def run_seed():
    """Create initial users and demo data if missing. Called on first run or via POST /api/seed."""
    # Create Super Admin
    super_admin = await db.users.find_one({"email": "superadmin@tebbi.com"})
    if not super_admin:
        super_admin_user = {
            "id": str(uuid.uuid4()),
            "email": "superadmin@tebbi.com",
            "password": hash_password("super123"),
            "name": "Super Admin",
            "name_ar": "مدير النظام",
            "role": "super_admin",
            "phone": "+963900000000",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(super_admin_user)
    
    # Create a demo company
    demo_company = await db.companies.find_one({"code": "DEMO"})
    if not demo_company:
        company_data = {
            "id": str(uuid.uuid4()),
            "name": "Demo Clinic",
            "name_ar": "عيادة تجريبية",
            "code": "DEMO",
            "email": "demo@tebbi.com",
            "phone": "+963911111111",
            "address": "Damascus, Syria",
            "address_ar": "دمشق، سوريا",
            "specialty": "general",
            "is_active": True,
            "subscription_status": "active",
            "subscription_end_date": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
            "trial_days": 14,
            "max_users": 10,
            "max_patients": 5000,
            "max_storage_mb": 5120,
            "features": {
                "dashboard": True,
                "patients": True,
                "appointments": True,
                "invoices": True,
                "ai_analysis": True,
                "reports": True,
                "online_booking": True
            },
            "users_count": 2,
            "patients_count": 0,
            "storage_used_mb": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.companies.insert_one(company_data)
        demo_company = company_data
    
    # Check if admin exists
    admin = await db.users.find_one({"email": "admin@tebbi.com"})
    if not admin:
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@tebbi.com",
            "password": hash_password("admin123"),
            "name": "Admin User",
            "name_ar": "المدير",
            "role": "company_admin",
            "company_id": demo_company.get("id"),
            "phone": "+963912345678",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
    
    # Seed a doctor
    doctor = await db.users.find_one({"email": "doctor@tebbi.com"})
    if not doctor:
        doctor_user = {
            "id": str(uuid.uuid4()),
            "email": "doctor@tebbi.com",
            "password": hash_password("doctor123"),
            "name": "Dr. Ahmad",
            "name_ar": "د. أحمد",
            "role": "doctor",
            "company_id": demo_company.get("id"),
            "phone": "+963922345678",
            "specialty": "cardiology",
            "specialty_ar": "أمراض القلب",
            "consultation_fee": 50000,
            "is_available_online": True,
            "working_hours": {
                "sunday": {"start": "09:00", "end": "17:00"},
                "monday": {"start": "09:00", "end": "17:00"},
                "tuesday": {"start": "09:00", "end": "17:00"},
                "wednesday": {"start": "09:00", "end": "17:00"},
                "thursday": {"start": "09:00", "end": "14:00"}
            },
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(doctor_user)
    
    # Seed another doctor with different specialty
    doctor2 = await db.users.find_one({"email": "doctor2@tebbi.com"})
    if not doctor2:
        doctor2_user = {
            "id": str(uuid.uuid4()),
            "email": "doctor2@tebbi.com",
            "password": hash_password("doctor123"),
            "name": "Dr. Fatima",
            "name_ar": "د. فاطمة",
            "role": "doctor",
            "company_id": demo_company.get("id"),
            "phone": "+963933345678",
            "specialty": "pediatrics",
            "specialty_ar": "طب الأطفال",
            "consultation_fee": 40000,
            "is_available_online": True,
            "working_hours": {
                "sunday": {"start": "10:00", "end": "18:00"},
                "monday": {"start": "10:00", "end": "18:00"},
                "tuesday": {"start": "10:00", "end": "18:00"},
                "wednesday": {"start": "10:00", "end": "18:00"},
                "thursday": {"start": "10:00", "end": "15:00"}
            },
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(doctor2_user)
    
    # Seed sample patients
    patient_count = await db.patients.count_documents({})
    if patient_count == 0:
        patients = [
            {
                "id": str(uuid.uuid4()),
                "name": "Mohammad Ali",
                "name_ar": "محمد علي",
                "company_id": demo_company.get("id"),
                "national_id": "1234567890",
                "date_of_birth": "1990-05-15",
                "gender": "male",
                "phone": "+963933456789",
                "address": "Damascus, Syria",
                "address_ar": "دمشق، سوريا",
                "blood_type": "A+",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Fatima Hassan",
                "name_ar": "فاطمة حسن",
                "company_id": demo_company.get("id"),
                "national_id": "0987654321",
                "date_of_birth": "1985-08-20",
                "gender": "female",
                "phone": "+963944567890",
                "address": "Aleppo, Syria",
                "address_ar": "حلب، سوريا",
                "blood_type": "O+",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        await db.patients.insert_many(patients)

    return {"message": "Seed data created successfully"}


# Minimal 1x1 PNG (transparent) for demo medical images - reused for all types with varied titles
_DEMO_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="


class SeedDemoPatientsRequest(BaseModel):
    count: int = 100
    company_id: Optional[str] = None


@api_router.get("/seed-demo-patients", tags=["Users"])
async def seed_demo_patients_info():
    """للتحقق: لو فتحت الرابط بالمتصفح تشوف 200 (استخدم POST من التطبيق)."""
    return {"ok": True, "message": "استخدم POST مع تسجيل الدخول لتحميل المرضى التجريبيين", "method": "POST"}


@api_router.post("/seed-demo-patients", tags=["Users"])
async def seed_demo_patients(
    body: Optional[SeedDemoPatientsRequest] = None,
    current_user: dict = Depends(get_current_user)
):
    """Create N demo patients with diagnoses, medications, visits, allergies, and medical images for the current user's company."""
    body = body or SeedDemoPatientsRequest()
    company_id = body.company_id or current_user.get("company_id")
    if not company_id and current_user.get("role") == "super_admin":
        first = await db.companies.find_one({}, {"id": 1})
        if first:
            company_id = first["id"]
    if not company_id:
        raise HTTPException(status_code=400, detail="سجّل دخول بحساب عيادة/طبيب (المستخدم يجب أن يكون مرتبطاً بشركة).")
    count = body.count
    count = max(1, min(count, 200))
    now_iso = datetime.now(timezone.utc).isoformat()

    # Data: names (name_ar, name), diagnoses (diagnosis_ar, diagnosis, code), medications (name_ar, name, dosage, frequency), allergies
    DEMO_NAMES = [
        ("محمد علي", "Mohammad Ali"), ("فاطمة حسن", "Fatima Hassan"), ("أحمد داوود", "Ahmad Dawood"),
        ("سارة إبراهيم", "Sara Ibrahim"), ("خالد محمود", "Khalid Mahmoud"), ("ليلى عمر", "Layla Omar"),
        ("يوسف ناصر", "Youssef Nasser"), ("نورا حسين", "Nora Hussein"), ("عمر رامي", "Omar Rami"),
        ("هدى سعد", "Huda Saad"), ("محمود كريم", "Mahmoud Karim"), ("رنا وائل", "Rana Wael"),
        ("باسم عدنان", "Basem Adnan"), ("لمياء فارس", "Lamya Fares"), ("وليد جمال", "Waleed Jamal"),
        ("إيمان زيد", "Iman Zaid"), ("رامي سامي", "Rami Sami"), ("داليا نادر", "Dalia Nader"),
        ("طارق بدر", "Tariq Badr"), ("سلمى حازم", "Salma Hatem"), ("كريم فادي", "Karim Fadi"),
        ("ميساء رفيق", "Maysaa Rafeek"), ("أنس طلال", "Anas Talal"), ("جمانة عاصم", "Jumana Asem"),
        ("فادي لؤي", "Fadi Loay"), ("رهام غسان", "Reham Ghassan"), ("سمير نبيل", "Sameer Nabil"),
        ("لينا ماهر", "Lina Maher"), ("زياد وسام", "Ziad Wissam"), ("هبة جاد", "Hiba Jad"),
        ("قصي معن", "Qusay Maan"), ("رندة باسل", "Randa Basel"), ("مازن ثائر", "Mazen Thaer"),
        ("دانا رامي", "Dana Rami"), ("صالح وليد", "Saleh Waleed"), ("لارا سعيد", "Lara Said"),
        ("نبيل رائف", "Nabil Raef"), ("يارا ناصر", "Yara Nasser"), ("عماد فهمي", "Emad Fahmy"),
        ("تالا بشار", "Tala Bashar"), ("رأفت منصور", "Raafat Mansour"), ("سهام كمال", "Siham Kamal"),
        ("حسام نزار", "Hussam Nizar"), ("مريم أنور", "Mariam Anwar"), ("فراس عادل", "Firas Adel"),
        ("رانية جميل", "Rania Jameel"), ("قصي هشام", "Qusay Hisham"), ("لينا فؤاد", "Lina Fouad"),
        ("سامر بدران", "Samer Badran"), ("نادية رشيد", "Nadia Rashid"), ("ماهر وديع", "Maher Wadie"),
        ("غادة سامر", "Ghada Samer"), ("وليد فهمي", "Waleed Fahmy"), ("هناء نبيل", "Hana Nabil"),
        ("عصام حمدي", "Essam Hamdy"), ("رنا ماهر", "Rana Maher"), ("جلال وائل", "Jalal Wael"),
        ("لارا كريم", "Lara Karim"), ("رامي سليم", "Rami Saleem"), ("داليا هاني", "Dalia Hani"),
        ("باسم رامز", "Basem Ramez"), ("سارة ناصر", "Sara Nasser"), ("خالد وليد", "Khalid Waleed"),
        ("ياسمين فارس", "Yasmin Fares"), ("مازن سعد", "Mazen Saad"), ("لمياء جمال", "Lamya Jamal"),
        ("أنس حازم", "Anas Hatem"), ("رهام عدنان", "Reham Adnan"), ("طارق زيد", "Tariq Zaid"),
        ("جمانة سامي", "Jumana Sami"), ("فادي نادر", "Fadi Nader"), ("ميساء بدر", "Maysaa Badr"),
        ("كريم طلال", "Karim Talal"), ("سلمى عاصم", "Salma Asem"), ("وليد لؤي", "Waleed Loay"),
        ("إيمان غسان", "Iman Ghassan"), ("رنا نبيل", "Rana Nabil"), ("داليا ماهر", "Dalia Maher"),
        ("باسم وسام", "Basem Wissam"), ("هدى جاد", "Huda Jad"), ("عمر معن", "Omar Maan"),
        ("نورا باسل", "Nora Basel"), ("يوسف ثائر", "Youssef Thaer"), ("سارة رامي", "Sara Rami"),
        ("محمود وليد", "Mahmoud Waleed"), ("ليلى سعيد", "Layla Said"), ("خالد رائف", "Khalid Raef"),
        ("فاطمة ناصر", "Fatima Nasser"), ("محمد فهمي", "Mohammad Fahmy"), ("أحمد بشار", "Ahmad Bashar"),
        ("سهام منصور", "Siham Mansour"), ("رندة كمال", "Randa Kamal"), ("مازن نزار", "Mazen Nizar"),
        ("دانا أنور", "Dana Anwar"), ("صالح عادل", "Saleh Adel"), ("لارا جميل", "Lara Jameel"),
        ("نبيل هشام", "Nabil Hisham"), ("يارا فؤاد", "Yara Fouad"), ("عماد بدران", "Emad Badran"),
        ("تالا رشيد", "Tala Rashid"), ("رأفت وديع", "Raafat Wadie"), ("غادة سامر", "Ghada Samer"),
        ("حسام فهمي", "Hussam Fahmy"), ("مريم نبيل", "Mariam Nabil"), ("فراس حمدي", "Firas Hamdy"),
        ("رانية ماهر", "Rania Maher"), ("قصي وائل", "Qusay Wael"), ("لينا كريم", "Lina Karim"),
        ("سامر سليم", "Samer Saleem"), ("نادية هاني", "Nadia Hani"), ("ماهر رامز", "Maher Ramez"),
    ]
    DEMO_DIAGNOSES = [
        ("سكري النوع الثاني", "Type 2 Diabetes Mellitus", "E11"),
        ("فرط ضغط الدم", "Hypertension", "I10"),
        ("ربو قصبي", "Bronchial Asthma", "J45"),
        ("داء الانسداد الرئوي المزمن", "COPD", "J44"),
        ("قصور كلوي مزمن", "Chronic Kidney Disease", "N18"),
        ("ذبحة صدرية مستقرة", "Stable Angina", "I20"),
        ("التهاب رئة مجتمعي", "Community-acquired Pneumonia", "J18"),
        ("فقر دم نقص الحديد", "Iron Deficiency Anemia", "D50"),
        ("قصور قلب", "Heart Failure", "I50"),
        ("داء الدراق العقدي", "Nodular Goiter", "E04"),
        ("اكتئاب", "Depression", "F32"),
        ("التهاب مفاصل رثياني", "Rheumatoid Arthritis", "M06"),
        ("داء الارتداد المعدي المريئي", "GERD", "K21"),
        ("هشاشة عظام", "Osteoporosis", "M81"),
        ("قصور درقية", "Hypothyroidism", "E03"),
        ("ديسليبيدميا", "Dyslipidemia", "E78"),
        ("التهاب القصبات الحاد", "Acute Bronchitis", "J20"),
        ("صداع توتر", "Tension Headache", "G44"),
        ("عدوى مسالك بولية", "Urinary Tract Infection", "N39"),
        ("التهاب معدة", "Gastritis", "K29"),
    ]
    DEMO_MEDICATIONS = [
        ("ميتفورمين", "Metformin", "500 ملغ", "مرتين يومياً"),
        ("أملوديبين", "Amlodipine", "5 ملغ", "مرة يومياً"),
        ("سالبيوتامول", "Salbutamol", "100 مكغ", "عند الحاجة"),
        ("أوميبرازول", "Omeprazole", "20 ملغ", "مرة صباحاً"),
        ("أسبرين", "Aspirin", "100 ملغ", "مرة يومياً"),
        ("أتورفاستاتين", "Atorvastatin", "20 ملغ", "مساءً"),
        ("لوزارتان", "Losartan", "50 ملغ", "مرة يومياً"),
        ("إنسولين غلارجين", "Insulin Glargine", "10 وحدات", "مساءً"),
        ("فوروسيميد", "Furosemide", "40 ملغ", "صبحاً"),
        ("باراسيتامول", "Paracetamol", "500 ملغ", "كل 6 ساعات عند الحاجة"),
        ("أموكسيسيلين", "Amoxicillin", "500 ملغ", "3 مرات يومياً"),
        ("إيبوبروفين", "Ibuprofen", "400 ملغ", "3 مرات عند الألم"),
        ("ليفوثيروكسين", "Levothyroxine", "50 مكغ", "صبحاً على الريق"),
        ("سيرترالين", "Sertraline", "50 ملغ", "مرة يومياً"),
        ("ميثوتريكسات", "Methotrexate", "7.5 ملغ", "أسبوعياً"),
        ("ديكلوفيناك", "Diclofenac", "50 ملغ", "مرتين يومياً"),
        ("هيدروكلوروثيازيد", "Hydrochlorothiazide", "25 ملغ", "صبحاً"),
        ("رانيتيدين", "Ranitidine", "150 ملغ", "مرتين يومياً"),
        ("فيتامين د", "Vitamin D", "1000 وحدة", "مرة يومياً"),
        ("حديد فموي", "Oral Iron", "100 ملغ", "مرة يومياً"),
    ]
    DEMO_ALLERGIES = [
        ("بنيسيلين", "Penicillin", "high"),
        ("غبار الطلع", "Pollen", "moderate"),
        ("اللبن", "Dairy", "moderate"),
        ("المكسرات", "Nuts", "high"),
        ("الأسبرين", "Aspirin", "moderate"),
    ]
    IMAGE_ENTRIES = [
        ("xray", "أشعة صدر - PA", "Chest X-Ray PA", "صورة أشعة سينية للصدر - الوضع الأمامي الخلفي"),
        ("xray", "أشعة عظام", "Bone X-Ray", "أشعة لطرف علوي"),
        ("ecg", "تخطيط قلب 12 قطب", "12-Lead ECG", "تخطيط كهربية القلب 12 قطب"),
        ("ecg", "تخطيط قلب روتيني", "Routine ECG", "تخطيط قلب للفحص الدوري"),
        ("lab_test", "تحليل CBC", "CBC", "عد دموي شامل"),
        ("lab_test", "سكر صائم", "Fasting Blood Sugar", "قياس غلوكوز الدم الصائم"),
        ("lab_test", "وظائف كلى", "Renal Function", "كرياتينين ويوريا"),
        ("lab_test", "شحوم الدم", "Lipid Profile", "كولسترول وثلاثي غليسريد"),
    ]
    DEMO_DOCTORS = [
        ("د. ياسر الخطيب", "Dr. Yasser Al-Khatib", "أمراض باطنية", "Internal Medicine", "demo-dr1@seed.tebbi.local"),
        ("د. نادية الحلبي", "Dr. Nadia Al-Halabi", "أمراض قلب", "Cardiology", "demo-dr2@seed.tebbi.local"),
        ("د. وائل الشامي", "Dr. Wael Al-Shami", "أطفال", "Pediatrics", "demo-dr3@seed.tebbi.local"),
        ("د. ريم دمشق", "Dr. Reem Dimashq", "نسائية وتوليد", "Obstetrics & Gynecology", "demo-dr4@seed.tebbi.local"),
        ("د. عمر حمص", "Dr. Omar Homs", "عظام", "Orthopedics", "demo-dr5@seed.tebbi.local"),
    ]
    DEFAULT_WORKING_HOURS = {
        "sunday": {"start": "09:00", "end": "17:00"},
        "monday": {"start": "09:00", "end": "17:00"},
        "tuesday": {"start": "09:00", "end": "17:00"},
        "wednesday": {"start": "09:00", "end": "17:00"},
        "thursday": {"start": "09:00", "end": "14:00"},
        "friday": {"start": "09:00", "end": "13:00"},
        "saturday": {"start": "09:00", "end": "17:00"},
    }

    doctor_ids = []
    for name_ar, name_en, spec_ar, spec_en, email in DEMO_DOCTORS:
        existing = await db.users.find_one({"email": email})
        if not existing:
            doc_id = str(uuid.uuid4())
            await db.users.insert_one({
                "id": doc_id,
                "email": email,
                "password": hash_password("Demo123!"),
                "name": name_en,
                "name_ar": name_ar,
                "role": "doctor",
                "company_id": company_id,
                "phone": encrypt_field("+963900000000"),
                "specialty": spec_en.lower().replace(" ", "_")[:50],
                "specialty_ar": spec_ar,
                "consultation_fee": 50000,
                "working_hours": DEFAULT_WORKING_HOURS,
                "is_available_online": True,
                "is_active": True,
                "created_at": now_iso,
            })
            doctor_ids.append(doc_id)
        else:
            doctor_ids.append(existing["id"])
    if not doctor_ids:
        existing_doctors = await db.users.find({"company_id": company_id, "role": "doctor"}, {"id": 1}).to_list(20)
        doctor_ids = [d["id"] for d in existing_doctors]
    if not doctor_ids:
        doctor_ids = [current_user.get("id")]

    created = 0
    doctor_id = current_user.get("id")
    doctor_name = current_user.get("name") or current_user.get("name_ar") or "Doctor"
    patient_ids_created = []

    for i in range(count):
        name_ar, name = DEMO_NAMES[i % len(DEMO_NAMES)]
        patient_id = str(uuid.uuid4())
        patient_ids_created.append(patient_id)
        # Birth dates: spread 1950-2010
        year = random.randint(1950, 2010)
        month = random.randint(1, 12)
        day = random.randint(1, 28)
        dob = f"{year}-{month:02d}-{day:02d}"
        gender = random.choice(["male", "female"])
        blood_types = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]
        phone = f"+9639{random.randint(10000000, 99999999)}"
        patient_doc = {
            "id": patient_id,
            "name": name,
            "name_ar": name_ar,
            "company_id": company_id,
            "national_id": f"DEMO{random.randint(100000, 999999)}",
            "date_of_birth": dob,
            "gender": gender,
            "phone": encrypt_field(phone),
            "address": encrypt_field("سوريا" if random.random() > 0.5 else "Syria"),
            "address_ar": encrypt_field("سوريا"),
            "blood_type": random.choice(blood_types),
            "height_cm": random.randint(155, 185) if gender == "male" else random.randint(150, 175),
            "weight_kg": round(random.uniform(55, 95), 1),
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        await db.patients.insert_one(patient_doc)

        num_dx = random.randint(1, 2)
        for _ in range(num_dx):
            diag = random.choice(DEMO_DIAGNOSES)
            dx_ar, dx_en, code = diag
            await db.diagnoses.insert_one({
                "id": str(uuid.uuid4()),
                "patient_id": patient_id,
                "doctor_id": doctor_id,
                "diagnosis": dx_en,
                "diagnosis_ar": dx_ar,
                "diagnosis_code": code,
                "notes": "",
                "is_ai_suggested": False,
                "created_at": now_iso,
            })

        num_meds = random.randint(1, 3)
        for _ in range(num_meds):
            med = random.choice(DEMO_MEDICATIONS)
            med_ar, med_en, dosage, freq = med
            await db.medications.insert_one({
                "id": str(uuid.uuid4()),
                "patient_id": patient_id,
                "doctor_id": doctor_id,
                "name": med_en,
                "name_ar": med_ar,
                "dosage": dosage,
                "frequency": freq,
                "frequency_ar": freq,
                "start_date": dob,
                "created_at": now_iso,
            })

        num_visits = random.randint(2, 5)
        for v in range(num_visits):
            visit_reason_ar = random.choice(["مراجعة دورية", "ألم صدر", "سعال", "ضغط مرتفع", "سكري", "نزلة برد", "ألم مفاصل"])
            visit_reason = random.choice(["Routine follow-up", "Chest pain", "Cough", "High BP", "Diabetes check", "Cold", "Joint pain"])
            diag = random.choice(DEMO_DIAGNOSES)
            dx_ar, dx_en, _ = diag
            days_ago = random.randint(5, 700)
            visit_date = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
            visit_id = str(uuid.uuid4())
            visit_doc = {
                "id": visit_id,
                "visit_number": f"V-{visit_id[:8].upper()}",
                "patient_id": patient_id,
                "doctor_id": doctor_id,
                "doctor_name": doctor_name,
                "reason": visit_reason,
                "reason_ar": visit_reason_ar,
                "diagnosis": dx_en,
                "diagnosis_ar": dx_ar,
                "temperature": round(random.uniform(36.2, 37.5), 1),
                "blood_pressure_systolic": random.randint(110, 145),
                "blood_pressure_diastolic": random.randint(70, 90),
                "heart_rate": random.randint(65, 88),
                "oxygen_saturation": random.randint(95, 100),
                "consultation_fee": 0,
                "additional_fees": 0,
                "total_amount": 0,
                "payment_status": "pending",
                "paid_amount": 0,
                "created_at": visit_date,
            }
            await db.visits.insert_one(visit_doc)

        if random.random() < 0.3:
            for _ in range(random.randint(1, 2)):
                aller = random.choice(DEMO_ALLERGIES)
                a_ar, a_en, sev = aller
                await db.allergies.insert_one({
                    "id": str(uuid.uuid4()),
                    "patient_id": patient_id,
                    "allergen": a_en,
                    "allergen_ar": a_ar,
                    "severity": sev,
                    "reaction": "Rash / حساسية جلدية",
                    "reaction_ar": "طفح جلدي",
                    "created_at": now_iso,
                })

        num_images = random.randint(1, 4)
        for _ in range(num_images):
            img_type, title_ar, title_en, desc_ar = random.choice(IMAGE_ENTRIES)
            await db.medical_images.insert_one({
                "id": str(uuid.uuid4()),
                "patient_id": patient_id,
                "image_type": img_type,
                "title": title_en,
                "title_ar": title_ar,
                "description": desc_ar,
                "description_ar": desc_ar,
                "image_base64": _DEMO_IMAGE_BASE64,
                "uploaded_by": doctor_id,
                "created_at": now_iso,
            })

        created += 1

    # Create appointments for the next 30 days (patients <-> demo doctors)
    today = datetime.now(timezone.utc).date()
    APPOINTMENT_REASONS = [
        ("مراجعة دورية", "Follow-up visit"),
        ("فحص عام", "General checkup"),
        ("استشارة جديدة", "New consultation"),
        ("مراجعة نتائج التحاليل", "Lab results review"),
        ("ألم في الظهر", "Back pain"),
        ("صداع متكرر", "Recurring headache"),
    ]
    appointments_created = 0
    for pid in patient_ids_created:
        n_app = random.randint(1, 4)
        used_slots = set()
        for _ in range(n_app):
            day_offset = random.randint(0, 30)
            app_date = today + timedelta(days=day_offset)
            hour = random.randint(8, 16)
            minute = random.choice([0, 15, 30, 45])
            slot = (app_date.isoformat(), f"{hour:02d}:{minute:02d}")
            if slot in used_slots:
                continue
            used_slots.add(slot)
            reason_ar, reason_en = random.choice(APPOINTMENT_REASONS)
            app_id = str(uuid.uuid4())
            app_doc = {
                "id": app_id,
                "patient_id": pid,
                "doctor_id": random.choice(doctor_ids),
                "date": app_date.isoformat(),
                "time": f"{hour:02d}:{minute:02d}",
                "duration_minutes": 30,
                "reason": reason_en,
                "reason_ar": reason_ar,
                "status": AppointmentStatus.SCHEDULED.value,
                "notes": None,
                "company_id": company_id,
                "created_at": now_iso,
            }
            await db.appointments.insert_one(app_doc)
            appointments_created += 1

    return {
        "message": f"Created {created} demo patients and {appointments_created} appointments",
        "count": created,
        "appointments_count": appointments_created,
        "doctors_count": len(doctor_ids),
    }


@api_router.get("/seed", tags=["Users"])
async def seed_data_get():
    """Trigger seed from browser: open http://localhost:8001/api/seed (creates users if DB empty)."""
    return await run_seed()


@api_router.post("/seed", tags=["Users"])
async def seed_data():
    """Manually trigger seed (creates initial users and demo data if missing)."""
    return await run_seed()

# ==================== MAIN APP SETUP ====================
# Root, /health, /ready are registered in routers/health.py

# Include router

# ==================== NOTIFICATION SETTINGS ====================
class NotificationSettings(BaseModel):
    notifications_enabled: bool = False
    sms_enabled: bool = False
    whatsapp_enabled: bool = False
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_phone_number: Optional[str] = None
    twilio_whatsapp_number: Optional[str] = None
    on_booking_created: bool = True
    on_booking_confirmed: bool = True
    on_booking_cancelled: bool = True
    on_booking_reminder: bool = True
    reminder_hours_before: int = 24
    reminder_2h_enabled: bool = False

@api_router.get("/settings/notifications", tags=["Notifications"])
async def get_notification_settings(current_user: dict = Depends(get_current_user)):
    company_id = current_user.get("company_id")
    if not company_id and current_user.get("role") != "super_admin":
        # Return default settings
        return NotificationSettings().model_dump()
    
    settings = await db.notification_settings.find_one(
        {"company_id": company_id} if company_id else {"is_global": True},
        {"_id": 0}
    )
    return settings or NotificationSettings().model_dump()

@api_router.put("/settings/notifications", tags=["Notifications"])
async def update_notification_settings(settings: NotificationSettings, current_user: dict = Depends(get_current_user)):
    company_id = current_user.get("company_id")
    
    settings_dict = settings.model_dump()
    settings_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    settings_dict["updated_by"] = current_user.get("id")
    
    if company_id:
        settings_dict["company_id"] = company_id
        await db.notification_settings.update_one(
            {"company_id": company_id},
            {"$set": settings_dict},
            upsert=True
        )
    else:
        settings_dict["is_global"] = True
        await db.notification_settings.update_one(
            {"is_global": True},
            {"$set": settings_dict},
            upsert=True
        )
    
    return {"message": "Settings updated"}

class TestNotificationRequest(BaseModel):
    type: str  # 'sms' or 'whatsapp'
    phone: str

@api_router.post("/notifications/test", tags=["Notifications"])
async def test_notification(request: TestNotificationRequest, current_user: dict = Depends(get_current_user)):
    company_id = current_user.get("company_id")
    
    # Get settings
    settings = await db.notification_settings.find_one(
        {"company_id": company_id} if company_id else {"is_global": True}
    )
    
    if not settings:
        raise HTTPException(status_code=400, detail="الإعدادات غير موجودة - يرجى حفظ الإعدادات أولاً")
    
    if not settings.get("twilio_account_sid") or not settings.get("twilio_auth_token"):
        raise HTTPException(status_code=400, detail="بيانات Twilio غير مكتملة")
    
    try:
        from twilio.rest import Client
        
        client = Client(settings["twilio_account_sid"], settings["twilio_auth_token"])
        
        if request.type == "sms":
            if not settings.get("twilio_phone_number"):
                raise HTTPException(status_code=400, detail="رقم هاتف Twilio غير محدد")
            
            message = client.messages.create(
                body="🏥 رسالة اختبار من نظام Tebbi الطبي - تم إعداد الإشعارات بنجاح!",
                from_=settings["twilio_phone_number"],
                to=request.phone
            )
        elif request.type == "whatsapp":
            whatsapp_from = settings.get("twilio_whatsapp_number") or "whatsapp:+14155238886"
            
            message = client.messages.create(
                body="🏥 رسالة اختبار من نظام Tebbi الطبي - تم إعداد إشعارات WhatsApp بنجاح!",
                from_=whatsapp_from,
                to=f"whatsapp:{request.phone.replace('whatsapp:', '')}"
            )
        else:
            raise HTTPException(status_code=400, detail="نوع الإشعار غير صحيح")
        
        return {"message": "تم إرسال الرسالة بنجاح", "sid": message.sid}
    
    except Exception as e:
        logger.error(f"Notification error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"فشل الإرسال: {str(e)}")

# Send notification helper function
async def send_booking_notification(booking: dict, event_type: str):
    """Send notification for booking events"""
    company_id = booking.get("company_id")
    
    settings = await db.notification_settings.find_one(
        {"company_id": company_id} if company_id else {"is_global": True}
    )
    
    if not settings or not settings.get("notifications_enabled"):
        return
    
    # Check if this event should trigger notification
    event_map = {
        "created": "on_booking_created",
        "confirmed": "on_booking_confirmed",
        "cancelled": "on_booking_cancelled"
    }
    
    if not settings.get(event_map.get(event_type, ""), False):
        return
    
    phone = decrypt_field(booking.get("patient_phone")) or booking.get("patient_phone")
    if not phone:
        return

    company = await db.companies.find_one({"id": company_id}) or {}
    templates = (settings.get("templates") or {})
    template_key = {"created": "booking_created", "confirmed": "booking_confirmation", "cancelled": "booking_cancelled"}.get(event_type)
    portal_link = ""
    if template_key and templates.get(template_key) and "{portal_link}" in (templates.get(template_key) or ""):
        portal_link = await _resolve_portal_link_for_booking(booking, company_id)
    booking_ctx = {
        "patient_name": booking.get("patient_name", ""),
        "date": booking.get("date", ""),
        "time": booking.get("time", ""),
        "confirmation_code": booking.get("confirmation_code", ""),
        "doctor_name": booking.get("doctor_name", ""),
        "clinic_name": company.get("name_ar", company.get("name", "")),
    }
    if template_key and templates.get(template_key):
        message_text = _get_reminder_message(settings, booking_ctx, company, template_key, default_template=templates.get(template_key), portal_link=portal_link)
    else:
        patient_name = booking_ctx["patient_name"]
        date = booking_ctx["date"]
        time = booking_ctx["time"]
        code = booking_ctx["confirmation_code"]
        messages = {
            "created": f"🏥 مرحباً {patient_name}\nتم استلام حجزك بنجاح\nالتاريخ: {date}\nالوقت: {time}\nرمز الحجز: {code}\nسيتم التواصل معك للتأكيد",
            "confirmed": f"✅ مرحباً {patient_name}\nتم تأكيد موعدك\nالتاريخ: {date}\nالوقت: {time}\nرمز الحجز: {code}\nنتطلع لرؤيتك!",
            "cancelled": f"❌ مرحباً {patient_name}\nنأسف لإلغاء موعدك\nالتاريخ: {date}\nرمز الحجز: {code}\nيمكنك حجز موعد جديد"
        }
        message_text = messages.get(event_type, "")
    if not message_text:
        return
    
    try:
        from twilio.rest import Client
        
        if not settings.get("twilio_account_sid") or not settings.get("twilio_auth_token"):
            return
        
        client = Client(settings["twilio_account_sid"], decrypt_field(settings.get("twilio_auth_token")) or settings.get("twilio_auth_token"))
        
        # Send SMS if enabled
        if settings.get("sms_enabled") and settings.get("twilio_phone_number"):
            try:
                client.messages.create(
                    body=message_text,
                    from_=settings["twilio_phone_number"],
                    to=phone
                )
                logger.info(f"SMS sent to {phone} for event {event_type}")
            except Exception as e:
                logger.error(f"SMS error: {str(e)}")
        
        # Send WhatsApp if enabled
        if settings.get("whatsapp_enabled"):
            whatsapp_from = settings.get("twilio_whatsapp_number") or "whatsapp:+14155238886"
            try:
                client.messages.create(
                    body=message_text,
                    from_=whatsapp_from,
                    to=f"whatsapp:{phone.replace('whatsapp:', '')}"
                )
                logger.info(f"WhatsApp sent to {phone} for event {event_type}")
            except Exception as e:
                logger.error(f"WhatsApp error: {str(e)}")
    
    except Exception as e:
        logger.error(f"Notification send error: {str(e)}")


# مسار تحميل المرضى التجريبيين: على الجذر بدون /api (الواجهة تستدعي هذا)
@app.get("/seed-demo-patients")
async def seed_demo_patients_info_root():
    return {"ok": True, "message": "استخدم POST مع تسجيل الدخول", "method": "POST"}


@app.post("/seed-demo-patients")
async def seed_demo_patients_root(
    body: Optional[SeedDemoPatientsRequest] = None,
    current_user: dict = Depends(get_current_user),
):
    return await seed_demo_patients(body, current_user)


app.include_router(api_router)


@app.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe checkout.session.completed to mark invoice as paid. Requires STRIPE_WEBHOOK_SECRET."""
    import stripe
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if not secret:
        return {"received": True}
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Signature verification failed: {e}")
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        invoice_id = session.get("metadata", {}).get("invoice_id")
        if not invoice_id:
            return {"received": True}
        invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
        if invoice:
            total = invoice.get("total", 0)
            amount_paid = session.get("amount_total", 0) / 100.0
            new_paid = invoice.get("paid_amount", 0) + amount_paid
            status = "paid" if new_paid >= total else "partial"
            await db.invoices.update_one(
                {"id": invoice_id},
                {"$set": {"paid_amount": new_paid, "payment_status": status}}
            )
            company_id = invoice.get("company_id")
            if company_id:
                await create_notification(
                    company_id,
                    "invoice_paid",
                    "تم تسجيل دفع / Payment recorded",
                    f"تم الدفع أونلاين للفاتورة #{invoice.get('invoice_number', invoice_id)}",
                    link="/billing",
                )
    return {"received": True}


# API rate-limit middleware: apply api_rate_limiter to /api/* (except /api/health)
class APIRateLimitMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = (scope.get("path") or "").strip()
        if path.startswith("/api/") and path != "/api/health" and path != "/api/ready":
            client = scope.get("client")
            client_ip = (client[0] if client else None) or "unknown"
            if not api_rate_limiter.is_allowed(client_ip):
                await send({
                    "type": "http.response.start",
                    "status": 429,
                    "headers": [(b"content-type", b"application/json")],
                })
                await send({
                    "type": "http.response.body",
                    "body": b'{"detail":"Too many requests. Please try again later."}',
                })
                return
        await self.app(scope, receive, send)


# Security headers (reduce XSS, clickjacking, MIME sniffing risks)
class SecurityHeadersMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-content-type-options", b"nosniff"))
                headers.append((b"x-frame-options", b"DENY"))
                headers.append((b"x-xss-protection", b"1; mode=block"))
                headers.append((b"referrer-policy", b"strict-origin-when-cross-origin"))
                message = {"type": message["type"], "status": message["status"], "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(APIRateLimitMiddleware)

# CORS
cors_origins = app_settings.get_cors_origins_list()
if not cors_origins or "*" in cors_origins:
    if "*" in (app_settings.cors_origins or "").split(","):
        logging.warning(
            "Security: CORS_ORIGINS is '*'. For production set CORS_ORIGINS to your frontend origin(s), e.g. https://yourdomain.com"
        )
    if not cors_origins:
        cors_origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
