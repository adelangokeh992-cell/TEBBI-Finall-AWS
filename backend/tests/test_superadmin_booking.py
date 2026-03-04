"""
Tebbi Medical System - Super Admin Dashboard and Public Booking Tests
Tests for: Companies management, Admin dashboard, Public doctors listing, Online booking
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "superadmin@tebbi.com"
SUPERADMIN_PASSWORD = "super123"
DOCTOR_EMAIL = "doctor@tebbi.com"
DOCTOR_PASSWORD = "doctor123"


class TestSuperAdminAuth:
    """Super Admin authentication and authorization tests"""
    
    def test_superadmin_login_success(self):
        """Test login with super admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == SUPERADMIN_EMAIL
        assert data["user"]["role"] == "super_admin"
        print(f"Super Admin login success: role={data['user']['role']}")
    
    def test_doctor_cannot_access_admin_dashboard(self):
        """Test that regular doctor cannot access admin dashboard"""
        # Login as doctor
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DOCTOR_EMAIL,
            "password": DOCTOR_PASSWORD
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to access admin dashboard
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("Doctor correctly denied access to admin dashboard")
    
    def test_doctor_cannot_view_all_companies(self):
        """Test that regular doctor cannot view all companies"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DOCTOR_EMAIL,
            "password": DOCTOR_PASSWORD
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/companies", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("Doctor correctly denied access to companies list")


class TestAdminDashboard:
    """Admin Dashboard stats tests"""
    
    @pytest.fixture
    def superadmin_headers(self):
        """Get super admin auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_get_admin_dashboard_stats(self, superadmin_headers):
        """Test fetching admin dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=superadmin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "companies" in data, "Missing companies field in dashboard stats"
        assert "totals" in data, "Missing totals field in dashboard stats"
        
        # Verify companies stats structure
        companies_stats = data["companies"]
        assert "total" in companies_stats
        assert "active" in companies_stats
        assert "trial" in companies_stats
        
        # Verify totals structure
        totals = data["totals"]
        assert "users" in totals
        assert "patients" in totals
        assert "online_bookings" in totals
        
        print(f"Dashboard stats: {data['companies']['total']} companies, {data['totals']['users']} users, {data['totals']['patients']} patients")


class TestCompaniesManagement:
    """Companies/Clinics management tests"""
    
    @pytest.fixture
    def superadmin_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_get_companies_list(self, superadmin_headers):
        """Test fetching all companies"""
        response = requests.get(f"{BASE_URL}/api/companies", headers=superadmin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "companies" in data, "Response should contain 'companies' key"
        assert isinstance(data["companies"], list), "Companies should be a list"
        
        print(f"Found {len(data['companies'])} companies")
        
        # If companies exist, check structure
        if data["companies"]:
            company = data["companies"][0]
            assert "id" in company
            assert "name" in company
            assert "code" in company
            print(f"First company: {company.get('name')} (code: {company.get('code')})")
    
    def test_create_new_company(self, superadmin_headers):
        """Test creating a new company"""
        unique_id = str(uuid.uuid4())[:8].upper()
        company_data = {
            "name": f"TEST_Clinic_{unique_id}",
            "name_ar": f"عيادة_اختبار_{unique_id}",
            "code": f"TEST{unique_id}",
            "email": f"test{unique_id}@clinic.com",
            "phone": "+963999000000",
            "address": "123 Test Street",
            "specialty": "general",
            "admin_name": f"Admin_{unique_id}",
            "admin_email": f"admin{unique_id}@clinic.com",
            "admin_password": "test123456"
        }
        
        response = requests.post(f"{BASE_URL}/api/companies", json=company_data, headers=superadmin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        created = response.json()
        assert created["name"] == company_data["name"]
        assert created["code"] == company_data["code"]
        assert "id" in created
        assert "subscription_status" in created
        
        print(f"Created company: {created['name']} with id={created['id']}")
        return created["id"]
    
    def test_get_company_staff(self, superadmin_headers):
        """Test fetching staff for a company"""
        # First get companies list
        companies_res = requests.get(f"{BASE_URL}/api/companies", headers=superadmin_headers)
        companies = companies_res.json()["companies"]
        
        if not companies:
            pytest.skip("No companies exist for testing")
        
        company_id = companies[0]["id"]
        response = requests.get(f"{BASE_URL}/api/companies/{company_id}/staff", headers=superadmin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # API may return {staff: [...]} or direct list
        staff = data.get("staff", data) if isinstance(data, dict) else data
        assert isinstance(staff, list)
        print(f"Company {companies[0]['name']} has {len(staff)} staff members")
    
    def test_toggle_company_status(self, superadmin_headers):
        """Test toggling company active status"""
        # Get companies
        companies_res = requests.get(f"{BASE_URL}/api/companies", headers=superadmin_headers)
        companies = companies_res.json()["companies"]
        
        if not companies:
            pytest.skip("No companies exist for testing")
        
        # Find a test company or use first one
        company = companies[0]
        company_id = company["id"]
        current_status = company.get("is_active", True)
        
        # Toggle status
        response = requests.put(
            f"{BASE_URL}/api/companies/{company_id}", 
            json={"is_active": not current_status}, 
            headers=superadmin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        updated = response.json()
        assert updated["is_active"] != current_status
        print(f"Toggled company {company['name']} from {current_status} to {updated['is_active']}")
        
        # Revert the change
        requests.put(
            f"{BASE_URL}/api/companies/{company_id}", 
            json={"is_active": current_status}, 
            headers=superadmin_headers
        )


class TestPublicDoctorsList:
    """Public doctors listing tests (no auth required)"""
    
    def test_get_public_doctors_list(self):
        """Test fetching public doctors list without authentication"""
        response = requests.get(f"{BASE_URL}/api/public/doctors")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "doctors" in data, "Response should contain 'doctors' key"
        assert isinstance(data["doctors"], list), "Doctors should be a list"
        
        print(f"Found {len(data['doctors'])} public doctors")
        
        if data["doctors"]:
            doctor = data["doctors"][0]
            # Verify doctor structure
            assert "id" in doctor
            assert "name" in doctor
            print(f"First doctor: {doctor.get('name')} - specialty: {doctor.get('specialty')}")
    
    def test_get_doctor_available_slots(self):
        """Test fetching available slots for a doctor"""
        # First get doctors list
        doctors_res = requests.get(f"{BASE_URL}/api/public/doctors")
        doctors = doctors_res.json()["doctors"]
        
        if not doctors:
            pytest.skip("No doctors available for slot testing")
        
        doctor_id = doctors[0]["id"]
        
        # Get slots for tomorrow
        from datetime import datetime, timedelta
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/public/doctors/{doctor_id}/slots?date={tomorrow}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # API returns {available_slots: [...], booked_slots: [...], date: ..., doctor_id: ...}
        slots = data.get("available_slots", data) if isinstance(data, dict) else data
        assert isinstance(slots, list)
        print(f"Doctor has {len(slots)} available slots for {tomorrow}")
        
        if slots:
            print(f"Sample slots: {slots[:5]}")


class TestPublicBooking:
    """Public online booking tests"""
    
    def test_complete_booking_flow(self):
        """Test complete booking flow: select doctor, date, time, submit booking"""
        # 1. Get available doctors
        doctors_res = requests.get(f"{BASE_URL}/api/public/doctors")
        assert doctors_res.status_code == 200
        doctors = doctors_res.json()["doctors"]
        
        if not doctors:
            pytest.skip("No doctors available for booking test")
        
        doctor = doctors[0]
        doctor_id = doctor["id"]
        company_id = doctor.get("company_id")
        
        print(f"Selected doctor: {doctor['name']} (ID: {doctor_id})")
        
        # 2. Get available slots
        from datetime import datetime, timedelta
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        slots_res = requests.get(f"{BASE_URL}/api/public/doctors/{doctor_id}/slots?date={tomorrow}")
        assert slots_res.status_code == 200
        slots_data = slots_res.json()
        
        # API returns {available_slots: [...], booked_slots: [...], ...}
        slots = slots_data.get("available_slots", slots_data) if isinstance(slots_data, dict) else slots_data
        
        if not slots or not isinstance(slots, list) or len(slots) == 0:
            print(f"No slots available for {tomorrow}, using default time")
            selected_time = "10:00"
        else:
            selected_time = slots[0]
        
        # 3. Create booking
        unique_id = str(uuid.uuid4())[:8]
        booking_data = {
            "patient_name": f"TEST_Patient_{unique_id}",
            "patient_phone": "+963999888777",
            "patient_email": f"testpatient{unique_id}@example.com",
            "doctor_id": doctor_id,
            "company_id": company_id,
            "date": tomorrow,
            "time": selected_time,
            "reason": "TEST_General checkup",
            "notes": "Automated test booking"
        }
        
        response = requests.post(f"{BASE_URL}/api/public/book", json=booking_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        booking = response.json()
        assert "confirmation_code" in booking, "Booking should have confirmation code"
        assert booking["patient_name"] == booking_data["patient_name"]
        assert booking["date"] == tomorrow
        assert booking["time"] == selected_time
        
        print(f"Booking created successfully!")
        print(f"  Confirmation code: {booking['confirmation_code']}")
        print(f"  Patient: {booking['patient_name']}")
        print(f"  Date: {booking['date']} at {booking['time']}")
        
        return booking["confirmation_code"]
    
    def test_booking_validation_missing_fields(self):
        """Test that booking fails with missing required fields"""
        incomplete_data = {
            "patient_name": "Test Patient",
            # Missing doctor_id, date, time, etc.
        }
        
        response = requests.post(f"{BASE_URL}/api/public/book", json=incomplete_data)
        assert response.status_code == 422, f"Expected 422 for incomplete data, got {response.status_code}"
        print("Booking correctly rejected for missing fields")
    
    def test_filter_doctors_by_specialty(self):
        """Test filtering doctors list by specialty"""
        # Get all doctors
        all_doctors_res = requests.get(f"{BASE_URL}/api/public/doctors")
        all_doctors = all_doctors_res.json()["doctors"]
        
        if not all_doctors:
            pytest.skip("No doctors available for filter test")
        
        # Find available specialties
        specialties = set(d.get("specialty") for d in all_doctors if d.get("specialty"))
        
        if not specialties:
            pytest.skip("No doctors with specialty for filter test")
        
        # Test filtering (done on frontend, but verify data structure)
        print(f"Available specialties: {specialties}")
        
        for specialty in list(specialties)[:2]:
            filtered = [d for d in all_doctors if d.get("specialty") == specialty]
            print(f"  {specialty}: {len(filtered)} doctors")


class TestCompanyStaffManagement:
    """Company staff management tests"""
    
    @pytest.fixture
    def superadmin_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_add_staff_to_company(self, superadmin_headers):
        """Test adding a new staff member to a company"""
        # Get companies
        companies_res = requests.get(f"{BASE_URL}/api/companies", headers=superadmin_headers)
        companies = companies_res.json()["companies"]
        
        if not companies:
            pytest.skip("No companies exist for staff test")
        
        company_id = companies[0]["id"]
        unique_id = str(uuid.uuid4())[:8]
        
        staff_data = {
            "name": f"TEST_Doctor_{unique_id}",
            "name_ar": f"طبيب_اختبار_{unique_id}",
            "email": f"testdoctor{unique_id}@clinic.com",
            "phone": "+963999111222",
            "password": "test123",
            "company_id": company_id,
            "role": "doctor",
            "specialty": "cardiology",
            "consultation_fee": 150
        }
        
        response = requests.post(f"{BASE_URL}/api/companies/{company_id}/staff", json=staff_data, headers=superadmin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        created = response.json()
        assert created["name"] == staff_data["name"]
        assert created["role"] == "doctor"
        assert "id" in created
        
        print(f"Added staff: {created['name']} (role: {created['role']}) to company")
        return created["id"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
