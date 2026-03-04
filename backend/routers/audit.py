"""
Audit log API routes.
"""


def register_audit_routes(router):
    from fastapi import Depends
    from typing import Optional

    from server import db, get_current_user, require_feature

    @router.get("/audit-logs", tags=["Audit"])
    async def get_audit_logs(
        current_user: dict = Depends(require_feature("audit_logs")),
        page: int = 1,
        limit: int = 50,
        action: Optional[str] = None,
        resource_type: Optional[str] = None
    ):
        """Get audit logs - Super Admin sees all, others see their company only."""
        query = {}
        if current_user.get("role") != "super_admin":
            query["company_id"] = current_user.get("company_id")
        if action:
            query["action"] = action
        if resource_type:
            query["resource_type"] = resource_type
        skip = (page - 1) * limit
        logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
        total = await db.audit_logs.count_documents(query)
        return {
            "logs": logs,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
