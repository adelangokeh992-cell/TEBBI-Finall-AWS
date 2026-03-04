"""
Patient CRUD API routes. Registers: create, list, get, update, delete.
"""


def register_patients_routes(router):
    from fastapi import Request, Depends, HTTPException
    from typing import List, Optional
    from datetime import datetime, timezone

    from server import (
        db,
        get_current_user,
        require_feature,
        log_audit,
        Patient,
        PatientCreate,
    )
    from crypto_utils import encrypt_field as _enc, decrypt_field as _dec

    @router.post("/patients", response_model=Patient, tags=["Patients"])
    async def create_patient(patient_data: PatientCreate, request: Request, current_user: dict = Depends(require_feature("patients"))):
        company_id = current_user.get("company_id")
        patient_obj = Patient(**patient_data.model_dump())
        doc = patient_obj.model_dump()
        doc["company_id"] = company_id
        doc["created_at"] = doc["created_at"].isoformat()
        doc["updated_at"] = doc["updated_at"].isoformat()
        for field in ("phone", "emergency_phone", "address", "address_ar", "emergency_contact", "chronic_conditions", "chronic_conditions_ar"):
            if doc.get(field):
                doc[field] = _enc(doc[field])
        await db.patients.insert_one(doc)
        await log_audit("create", "patient", resource_id=patient_obj.id, user=current_user, request=request)
        return patient_obj

    @router.get("/patients", response_model=List[Patient], tags=["Patients"])
    async def get_patients(current_user: dict = Depends(require_feature("patients")), search: Optional[str] = None):
        company_id = current_user.get("company_id")
        query = {}
        if current_user.get("role") != "super_admin" and company_id:
            query["company_id"] = company_id
        if search:
            search_conditions = {"$or": [
                {"name": {"$regex": search, "$options": "i"}},
                {"name_ar": {"$regex": search, "$options": "i"}},
                {"national_id": {"$regex": search, "$options": "i"}}
            ]}
            query = {"$and": [query, search_conditions]} if query else search_conditions
        patients = await db.patients.find(query, {"_id": 0}).to_list(1000)
        patient_ids = [p["id"] for p in patients]
        pipeline = [
            {"$match": {"patient_id": {"$in": patient_ids}}},
            {"$sort": {"created_at": -1}},
            {"$group": {"_id": "$patient_id", "last_visit_date": {"$first": "$created_at"}}},
        ]
        last_visits = {}
        async for doc in db.visits.aggregate(pipeline):
            dt = doc.get("last_visit_date")
            last_visits[doc["_id"]] = dt.isoformat()[:10] if isinstance(dt, datetime) else (dt[:10] if dt else None)
        _phi_fields = ("phone", "emergency_phone", "address", "address_ar", "emergency_contact", "chronic_conditions", "chronic_conditions_ar")
        for p in patients:
            for field in _phi_fields:
                if p.get(field):
                    p[field] = _dec(p[field])
            p["last_visit_date"] = last_visits.get(p["id"])
        return patients

    @router.get("/patients/{patient_id}", response_model=Patient, tags=["Patients"])
    async def get_patient(patient_id: str, request: Request, current_user: dict = Depends(require_feature("patients"))):
        company_id = current_user.get("company_id")
        query = {"id": patient_id}
        if current_user.get("role") != "super_admin" and company_id:
            query["company_id"] = company_id
        patient = await db.patients.find_one(query, {"_id": 0})
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        await log_audit("view", "patient", resource_id=patient_id, user=current_user, request=request)
        for field in ("phone", "emergency_phone", "address", "address_ar", "emergency_contact", "chronic_conditions", "chronic_conditions_ar"):
            if patient.get(field):
                patient[field] = _dec(patient[field])
        return patient

    @router.put("/patients/{patient_id}", response_model=Patient, tags=["Patients"])
    async def update_patient(patient_id: str, patient_data: PatientCreate, request: Request, current_user: dict = Depends(require_feature("patients"))):
        company_id = current_user.get("company_id")
        query = {"id": patient_id}
        if current_user.get("role") != "super_admin" and company_id:
            query["company_id"] = company_id
        patient = await db.patients.find_one(query)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        update_data = patient_data.model_dump()
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        for field in ("phone", "emergency_phone", "address", "address_ar", "emergency_contact", "chronic_conditions", "chronic_conditions_ar"):
            if update_data.get(field) is not None:
                update_data[field] = _enc(update_data[field]) if update_data.get(field) else update_data[field]
        await db.patients.update_one(query, {"$set": update_data})
        await log_audit("update", "patient", resource_id=patient_id, user=current_user, request=request)
        updated = await db.patients.find_one({"id": patient_id}, {"_id": 0})
        for field in ("phone", "emergency_phone", "address", "address_ar", "emergency_contact", "chronic_conditions", "chronic_conditions_ar"):
            if updated.get(field):
                updated[field] = _dec(updated[field])
        return updated

    @router.delete("/patients/{patient_id}", tags=["Patients"])
    async def delete_patient(patient_id: str, request: Request, current_user: dict = Depends(require_feature("patients"))):
        company_id = current_user.get("company_id")
        query = {"id": patient_id}
        if current_user.get("role") != "super_admin" and company_id:
            query["company_id"] = company_id
        result = await db.patients.delete_one(query)
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Patient not found")
        await log_audit("delete", "patient", resource_id=patient_id, user=current_user, request=request)
        return {"message": "Patient deleted successfully"}
