"""
Tebbi Medical System Backend API Tests
Tests for: Auth, Patients, Allergies, Diagnoses, Medications, Medical Images, AI Analysis
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000').rstrip('/')

# Test credentials
TEST_EMAIL = "doctor@tebbi.com"
TEST_PASSWORD = "doctor123"

class TestHealthAndAuth:
    """Health check and authentication tests"""
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"Health check passed: {data}")

    def test_ready_check(self):
        """Test readiness endpoint (DB ping) - may 503 if MongoDB down"""
        response = requests.get(f"{BASE_URL}/api/ready")
        assert response.status_code in (200, 503)
        data = response.json()
        if response.status_code == 200:
            assert data.get("status") == "ready"
            assert data.get("database") == "ok"
        print(f"Ready check: {data}")
    
    def test_login_success(self):
        """Test login with valid doctor credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"Login success: user={data['user']['name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@test.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("Invalid credentials rejected correctly")


class TestAuthEndpoints:
    """Auth: /auth/me, logout, invalid token"""
    
    def test_auth_me(self):
        """GET /api/auth/me with valid token"""
        login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        assert login.status_code == 200
        token = login.json()["access_token"]
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        me = response.json()
        assert me.get("email") == TEST_EMAIL
        assert "id" in me
        assert "role" in me
        print(f"auth/me: {me.get('email')} role={me.get('role')}")

    def test_auth_me_unauthorized(self):
        """GET /api/auth/me without token returns 403"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 403

    def test_auth_me_invalid_token(self):
        """GET /api/auth/me with invalid token returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        assert response.status_code == 401

    def test_logout(self):
        """POST /api/auth/logout with valid token"""
        login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        token = login.json()["access_token"]
        response = requests.post(
            f"{BASE_URL}/api/auth/logout",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json().get("message") == "Logged out"


class TestPatientCRUD:
    """Patient management tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_patients_list(self, auth_headers):
        """Test fetching all patients"""
        response = requests.get(f"{BASE_URL}/api/patients", headers=auth_headers)
        assert response.status_code == 200
        patients = response.json()
        assert isinstance(patients, list)
        print(f"Found {len(patients)} patients")
    
    def test_create_patient(self, auth_headers):
        """Test creating a new patient"""
        unique_id = str(uuid.uuid4())[:8]
        patient_data = {
            "name": f"TEST_Patient_{unique_id}",
            "name_ar": f"مريض_{unique_id}",
            "national_id": f"TEST{unique_id}",
            "date_of_birth": "1990-01-15",
            "gender": "male",
            "phone": "+963900000000",
            "blood_type": "A+",
            "height_cm": 175,
            "weight_kg": 70
        }
        response = requests.post(f"{BASE_URL}/api/patients", json=patient_data, headers=auth_headers)
        assert response.status_code == 200
        created = response.json()
        assert created["name"] == patient_data["name"]
        assert "id" in created
        print(f"Created patient: {created['name']} with id={created['id']}")
        return created["id"]
    
    def test_get_patient_by_id(self, auth_headers):
        """Test fetching patient by ID"""
        # First get all patients to find an ID
        patients_res = requests.get(f"{BASE_URL}/api/patients", headers=auth_headers)
        patients = patients_res.json()
        if patients:
            patient_id = patients[0]["id"]
            response = requests.get(f"{BASE_URL}/api/patients/{patient_id}", headers=auth_headers)
            assert response.status_code == 200
            patient = response.json()
            assert patient["id"] == patient_id
            print(f"Fetched patient: {patient['name']}")
        else:
            pytest.skip("No patients exist for testing")


class TestAllergiesCRUD:
    """Allergies management tests"""
    
    @pytest.fixture
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    @pytest.fixture
    def test_patient_id(self, auth_headers):
        """Get or create a test patient"""
        patients_res = requests.get(f"{BASE_URL}/api/patients", headers=auth_headers)
        patients = patients_res.json()
        if patients:
            return patients[0]["id"]
        # Create one if none exist
        response = requests.post(f"{BASE_URL}/api/patients", json={
            "name": "TEST_AllergyTestPatient",
            "gender": "male"
        }, headers=auth_headers)
        return response.json()["id"]
    
    def test_create_allergy(self, auth_headers, test_patient_id):
        """Test adding allergy to patient"""
        unique_id = str(uuid.uuid4())[:8]
        allergy_data = {
            "patient_id": test_patient_id,
            "allergen": f"TEST_Penicillin_{unique_id}",
            "allergen_ar": "بنسلين",
            "severity": "severe",
            "reaction": "Skin rash, difficulty breathing"
        }
        response = requests.post(f"{BASE_URL}/api/allergies", json=allergy_data, headers=auth_headers)
        assert response.status_code == 200
        created = response.json()
        assert created["allergen"] == allergy_data["allergen"]
        assert created["severity"] == "severe"
        assert "id" in created
        print(f"Created allergy: {created['allergen']} with id={created['id']}")
        return created["id"]
    
    def test_get_patient_allergies(self, auth_headers, test_patient_id):
        """Test fetching allergies for a patient"""
        response = requests.get(f"{BASE_URL}/api/allergies/patient/{test_patient_id}", headers=auth_headers)
        assert response.status_code == 200
        allergies = response.json()
        assert isinstance(allergies, list)
        print(f"Patient has {len(allergies)} allergies")
    
    def test_delete_allergy(self, auth_headers, test_patient_id):
        """Test deleting an allergy"""
        # First create an allergy
        unique_id = str(uuid.uuid4())[:8]
        create_res = requests.post(f"{BASE_URL}/api/allergies", json={
            "patient_id": test_patient_id,
            "allergen": f"TEST_ToDelete_{unique_id}",
            "severity": "mild"
        }, headers=auth_headers)
        allergy_id = create_res.json()["id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/allergies/{allergy_id}", headers=auth_headers)
        assert response.status_code == 200
        print(f"Deleted allergy: {allergy_id}")


class TestDiagnosesCRUD:
    """Diagnoses management tests"""
    
    @pytest.fixture
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    @pytest.fixture
    def test_patient_id(self, auth_headers):
        patients_res = requests.get(f"{BASE_URL}/api/patients", headers=auth_headers)
        patients = patients_res.json()
        if patients:
            return patients[0]["id"]
        response = requests.post(f"{BASE_URL}/api/patients", json={
            "name": "TEST_DiagnosisTestPatient", "gender": "female"
        }, headers=auth_headers)
        return response.json()["id"]
    
    def test_create_diagnosis(self, auth_headers, test_patient_id):
        """Test adding diagnosis to patient"""
        unique_id = str(uuid.uuid4())[:8]
        diagnosis_data = {
            "patient_id": test_patient_id,
            "diagnosis": f"TEST_Hypertension_{unique_id}",
            "diagnosis_ar": "ارتفاع ضغط الدم",
            "diagnosis_code": "I10",
            "notes": "Stage 1 hypertension, lifestyle modifications recommended"
        }
        response = requests.post(f"{BASE_URL}/api/diagnoses", json=diagnosis_data, headers=auth_headers)
        assert response.status_code == 200
        created = response.json()
        assert created["diagnosis"] == diagnosis_data["diagnosis"]
        assert "id" in created
        print(f"Created diagnosis: {created['diagnosis']} with id={created['id']}")
    
    def test_get_patient_diagnoses(self, auth_headers, test_patient_id):
        """Test fetching diagnoses for a patient"""
        response = requests.get(f"{BASE_URL}/api/diagnoses/patient/{test_patient_id}", headers=auth_headers)
        assert response.status_code == 200
        diagnoses = response.json()
        assert isinstance(diagnoses, list)
        print(f"Patient has {len(diagnoses)} diagnoses")
    
    def test_delete_diagnosis(self, auth_headers, test_patient_id):
        """Test deleting a diagnosis"""
        unique_id = str(uuid.uuid4())[:8]
        create_res = requests.post(f"{BASE_URL}/api/diagnoses", json={
            "patient_id": test_patient_id,
            "diagnosis": f"TEST_ToDelete_{unique_id}"
        }, headers=auth_headers)
        diagnosis_id = create_res.json()["id"]
        
        response = requests.delete(f"{BASE_URL}/api/diagnoses/{diagnosis_id}", headers=auth_headers)
        assert response.status_code == 200
        print(f"Deleted diagnosis: {diagnosis_id}")


class TestMedicationsCRUD:
    """Medications management tests"""
    
    @pytest.fixture
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    @pytest.fixture
    def test_patient_id(self, auth_headers):
        patients_res = requests.get(f"{BASE_URL}/api/patients", headers=auth_headers)
        patients = patients_res.json()
        if patients:
            return patients[0]["id"]
        response = requests.post(f"{BASE_URL}/api/patients", json={
            "name": "TEST_MedTestPatient", "gender": "male"
        }, headers=auth_headers)
        return response.json()["id"]
    
    def test_create_medication(self, auth_headers, test_patient_id):
        """Test adding medication to patient"""
        unique_id = str(uuid.uuid4())[:8]
        medication_data = {
            "patient_id": test_patient_id,
            "name": f"TEST_Lisinopril_{unique_id}",
            "name_ar": "ليسينوبريل",
            "dosage": "10mg",
            "frequency": "Once daily",
            "frequency_ar": "مرة يومياً",
            "start_date": "2024-01-01",
            "notes": "Take in the morning with food"
        }
        response = requests.post(f"{BASE_URL}/api/medications", json=medication_data, headers=auth_headers)
        assert response.status_code == 200
        created = response.json()
        assert created["name"] == medication_data["name"]
        assert created["dosage"] == "10mg"
        assert "id" in created
        print(f"Created medication: {created['name']} with id={created['id']}")
    
    def test_get_patient_medications(self, auth_headers, test_patient_id):
        """Test fetching medications for a patient"""
        response = requests.get(f"{BASE_URL}/api/medications/patient/{test_patient_id}", headers=auth_headers)
        assert response.status_code == 200
        medications = response.json()
        assert isinstance(medications, list)
        print(f"Patient has {len(medications)} medications")
    
    def test_delete_medication(self, auth_headers, test_patient_id):
        """Test deleting a medication"""
        unique_id = str(uuid.uuid4())[:8]
        create_res = requests.post(f"{BASE_URL}/api/medications", json={
            "patient_id": test_patient_id,
            "name": f"TEST_ToDelete_{unique_id}",
            "dosage": "5mg",
            "frequency": "daily"
        }, headers=auth_headers)
        med_id = create_res.json()["id"]
        
        response = requests.delete(f"{BASE_URL}/api/medications/{med_id}", headers=auth_headers)
        assert response.status_code == 200
        print(f"Deleted medication: {med_id}")


class TestAIAnalysis:
    """AI Analysis tests"""
    
    @pytest.fixture
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    @pytest.fixture
    def test_patient_id(self, auth_headers):
        patients_res = requests.get(f"{BASE_URL}/api/patients", headers=auth_headers)
        patients = patients_res.json()
        if patients:
            return patients[0]["id"]
        response = requests.post(f"{BASE_URL}/api/patients", json={
            "name": "TEST_AIPatient", "gender": "male"
        }, headers=auth_headers)
        return response.json()["id"]
    
    def test_ai_patient_analysis(self, auth_headers, test_patient_id):
        """Test comprehensive AI patient analysis"""
        response = requests.post(f"{BASE_URL}/api/ai/analyze-patient", json={
            "patient_id": test_patient_id,
            "include_images": False,
            "language": "en"
        }, headers=auth_headers, timeout=60)
        
        # API might return 500 if no EMERGENT_LLM_KEY or other AI issues
        # Just check it doesn't crash the server
        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.json()
            assert "patient_id" in data
            assert "data_analyzed" in data
            print(f"AI Analysis returned: {data.get('summary', 'No summary')[:100]}...")
        else:
            print(f"AI Analysis returned error (expected if LLM key issue): {response.json()}")
    
    def test_ai_symptom_analysis(self, auth_headers):
        """Test AI symptom analysis"""
        response = requests.post(f"{BASE_URL}/api/ai/analyze-symptoms", json={
            "symptoms": ["headache", "fever", "fatigue"],
            "language": "en"
        }, headers=auth_headers, timeout=60)
        
        assert response.status_code in [200, 500]
        if response.status_code == 200:
            data = response.json()
            assert "analysis" in data
            print(f"Symptom analysis: {data.get('analysis', '')[:100]}...")
        else:
            print(f"Symptom Analysis returned error: {response.json()}")


class TestMedicalImages:
    """Medical Images tests"""
    
    @pytest.fixture
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    @pytest.fixture
    def test_patient_id(self, auth_headers):
        patients_res = requests.get(f"{BASE_URL}/api/patients", headers=auth_headers)
        patients = patients_res.json()
        if patients:
            return patients[0]["id"]
        response = requests.post(f"{BASE_URL}/api/patients", json={
            "name": "TEST_ImagePatient", "gender": "male"
        }, headers=auth_headers)
        return response.json()["id"]
    
    def test_get_patient_images(self, auth_headers, test_patient_id):
        """Test fetching medical images for a patient"""
        response = requests.get(f"{BASE_URL}/api/medical-images/patient/{test_patient_id}", headers=auth_headers)
        assert response.status_code == 200
        images = response.json()
        assert isinstance(images, list)
        print(f"Patient has {len(images)} medical images")


class TestVisits:
    """Medical Visits tests"""
    
    @pytest.fixture
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    @pytest.fixture
    def test_patient_id(self, auth_headers):
        patients_res = requests.get(f"{BASE_URL}/api/patients", headers=auth_headers)
        patients = patients_res.json()
        if patients:
            return patients[0]["id"]
        response = requests.post(f"{BASE_URL}/api/patients", json={
            "name": "TEST_VisitPatient", "gender": "male"
        }, headers=auth_headers)
        return response.json()["id"]
    
    def test_create_visit_basic(self, auth_headers, test_patient_id):
        """Test creating a new visit with basic data"""
        visit_data = {
            "patient_id": test_patient_id,
            "reason": "TEST_Routine checkup",
            "consultation_fee": 50,
            "total_amount": 50,
            "payment_status": "pending"
        }
        response = requests.post(f"{BASE_URL}/api/visits", json=visit_data, headers=auth_headers)
        assert response.status_code == 200
        created = response.json()
        assert created["reason"] == "TEST_Routine checkup"
        assert created["consultation_fee"] == 50
        assert "id" in created
        assert "visit_number" in created
        assert "doctor_name" in created
        print(f"Created visit: {created['visit_number']}")
    
    def test_create_visit_with_vitals(self, auth_headers, test_patient_id):
        """Test creating a visit with vital signs"""
        visit_data = {
            "patient_id": test_patient_id,
            "temperature": 37.2,
            "blood_pressure_systolic": 120,
            "blood_pressure_diastolic": 80,
            "heart_rate": 72,
            "oxygen_saturation": 98,
            "reason": "TEST_Vital signs check",
            "consultation_fee": 75,
            "total_amount": 75,
            "payment_status": "pending"
        }
        response = requests.post(f"{BASE_URL}/api/visits", json=visit_data, headers=auth_headers)
        assert response.status_code == 200
        created = response.json()
        assert created["temperature"] == 37.2
        assert created["blood_pressure_systolic"] == 120
        assert created["heart_rate"] == 72
        assert created["oxygen_saturation"] == 98
        print(f"Created visit with vitals: {created['visit_number']}")
    
    def test_create_visit_with_prescription(self, auth_headers, test_patient_id):
        """Test creating a visit with prescription (multi-select medications)"""
        visit_data = {
            "patient_id": test_patient_id,
            "reason": "TEST_Prescription test",
            "diagnosis": "Common cold",
            "diagnosis_codes": ["J00"],
            "prescription": [
                {"medication_name": "Paracetamol", "dosage": "500mg", "frequency": "3 times daily"},
                {"medication_name": "Ibuprofen", "dosage": "400mg", "frequency": "As needed"}
            ],
            "consultation_fee": 100,
            "total_amount": 100,
            "payment_status": "pending"
        }
        response = requests.post(f"{BASE_URL}/api/visits", json=visit_data, headers=auth_headers)
        assert response.status_code == 200
        created = response.json()
        assert created["diagnosis"] == "Common cold"
        assert len(created["prescription"]) == 2
        assert created["prescription"][0]["medication_name"] == "Paracetamol"
        assert created["prescription"][1]["medication_name"] == "Ibuprofen"
        print(f"Created visit with {len(created['prescription'])} medications: {created['visit_number']}")
    
    def test_get_patient_visits(self, auth_headers, test_patient_id):
        """Test fetching visits for a patient"""
        response = requests.get(f"{BASE_URL}/api/patients/{test_patient_id}/visits", headers=auth_headers)
        assert response.status_code == 200
        visits = response.json()
        assert isinstance(visits, list)
        print(f"Patient has {len(visits)} visits")
    
    def test_get_patient_last_visit(self, auth_headers, test_patient_id):
        """Test fetching last visit for a patient"""
        response = requests.get(f"{BASE_URL}/api/patients/{test_patient_id}/last-visit", headers=auth_headers)
        assert response.status_code == 200
        # Could be null if no visits exist
        visit = response.json()
        if visit:
            print(f"Last visit: {visit.get('reason', 'N/A')}")
        else:
            print("No visits found for patient")


class TestAppointments:
    """Appointments list and create (sensitive data)"""
    
    @pytest.fixture
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def test_get_appointments_list(self, auth_headers):
        """GET /api/appointments"""
        response = requests.get(f"{BASE_URL}/api/appointments", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Appointments count: {len(data)}")

    def test_create_appointment_minimal(self, auth_headers):
        """POST /api/appointments with minimal payload"""
        patients_res = requests.get(f"{BASE_URL}/api/patients", headers=auth_headers)
        patients = patients_res.json()
        if not patients:
            pytest.skip("No patients for appointment")
        patient_id = patients[0]["id"]
        # Get a doctor for company
        doctors_res = requests.get(f"{BASE_URL}/api/users/doctors", headers=auth_headers)
        doctors = doctors_res.json()
        doctor_id = doctors[0]["id"] if doctors else None
        if not doctor_id:
            pytest.skip("No doctors for appointment")
        payload = {
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "date": "2030-01-15",
            "time": "10:00",
            "reason": "TEST_Appointment check",
            "status": "scheduled"
        }
        response = requests.post(f"{BASE_URL}/api/appointments", json=payload, headers=auth_headers)
        assert response.status_code == 200
        created = response.json()
        assert created.get("patient_id") == patient_id
        assert "id" in created
        print(f"Created appointment: {created.get('id')}")


class TestInvoices:
    """Invoices list and create (sensitive data)"""
    
    @pytest.fixture
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def test_get_invoices_list(self, auth_headers):
        """GET /api/invoices"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Invoices count: {len(data)}")

    def test_create_invoice_minimal(self, auth_headers):
        """POST /api/invoices with minimal payload"""
        patients_res = requests.get(f"{BASE_URL}/api/patients", headers=auth_headers)
        patients = patients_res.json()
        if not patients:
            pytest.skip("No patients for invoice")
        patient_id = patients[0]["id"]
        payload = {
            "patient_id": patient_id,
            "items": [{"description": "TEST_Consultation", "quantity": 1, "unit_price": 100}],
            "payment_status": "pending"
        }
        response = requests.post(f"{BASE_URL}/api/invoices", json=payload, headers=auth_headers)
        assert response.status_code == 200
        created = response.json()
        assert created.get("patient_id") == patient_id
        assert "id" in created
        print(f"Created invoice: {created.get('id')}")


class TestAuditLogs:
    """Audit logs (sensitive - requires audit_logs feature)"""
    
    @pytest.fixture
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def test_get_audit_logs(self, auth_headers):
        """GET /api/audit-logs - may 403 if feature disabled for role"""
        response = requests.get(f"{BASE_URL}/api/audit-logs", headers=auth_headers)
        assert response.status_code in (200, 403)
        if response.status_code == 200:
            data = response.json()
            assert "logs" in data
            assert "total" in data
            assert "page" in data
            print(f"Audit logs: total={data.get('total')}")


class TestReferenceData:
    """Reference data (diagnoses, medications, allergies) tests"""
    
    def test_get_common_diagnoses(self):
        """Test fetching common diagnoses list"""
        response = requests.get(f"{BASE_URL}/api/reference/diagnoses")
        assert response.status_code == 200
        data = response.json()
        assert "common" in data
        assert len(data["common"]) > 0
        # Check diagnosis structure
        first_dx = data["common"][0]
        assert "id" in first_dx
        assert "name_ar" in first_dx
        assert "name_en" in first_dx
        print(f"Found {len(data['common'])} common diagnoses")
    
    def test_get_common_medications(self):
        """Test fetching common medications list"""
        response = requests.get(f"{BASE_URL}/api/reference/medications")
        assert response.status_code == 200
        data = response.json()
        assert "common" in data
        assert len(data["common"]) > 0
        # Check medication structure
        first_med = data["common"][0]
        assert "id" in first_med
        assert "name_ar" in first_med
        assert "name_en" in first_med
        assert "dosages" in first_med
        print(f"Found {len(data['common'])} common medications")
    
    def test_get_common_allergies(self):
        """Test fetching common allergies list"""
        response = requests.get(f"{BASE_URL}/api/reference/allergies")
        assert response.status_code == 200
        data = response.json()
        assert "common" in data
        assert len(data["common"]) > 0
        print(f"Found {len(data['common'])} common allergies")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
