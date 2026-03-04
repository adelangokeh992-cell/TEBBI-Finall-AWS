"""
Test suite for Backup & Notification Settings APIs
Tests: 
- POST /api/companies/{id}/backups - Create backup
- GET /api/companies/{id}/backups - List backups
- POST /api/companies/{id}/backups/{backup_id}/restore - Restore backup
- DELETE /api/companies/{id}/backups/{backup_id} - Delete backup
- GET /api/companies/{id}/notification-settings - Get settings
- POST /api/companies/{id}/notification-settings - Save settings
- POST /api/companies/{id}/test-notification - Test notification connection
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from problem statement
SUPER_ADMIN_CREDENTIALS = {
    "email": "superadmin@tebbi.com",
    "password": "super123"
}

CLINIC_ADMIN_CREDENTIALS = {
    "email": "doctor@tebbi.com", 
    "password": "doctor123"
}

DEMO_COMPANY_ID = "355b4886-2ec0-41c6-bab3-57ac4ec85294"


class TestBackupAPIs:
    """Tests for Backup functionality - Super Admin only"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as super admin before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDENTIALS)
        assert response.status_code == 200, f"Super admin login failed: {response.text}"
        token = response.json().get("access_token")
        assert token, "No access token received"
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.token = token
        
    def test_01_super_admin_can_create_backup(self):
        """Test backup creation for a company"""
        response = self.session.post(f"{BASE_URL}/api/companies/{DEMO_COMPANY_ID}/backups")
        
        assert response.status_code == 200, f"Create backup failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Backup should have an ID"
        assert data["company_id"] == DEMO_COMPANY_ID, "Company ID should match"
        assert data["status"] == "success", "Backup status should be success"
        assert "size" in data, "Backup should have size info"
        assert "created_at" in data, "Backup should have created_at"
        
        # Store backup ID for later tests
        self.__class__.test_backup_id = data["id"]
        print(f"✓ Created backup {data['id']} with size {data['size']}")
        
    def test_02_get_company_backups(self):
        """Test listing backups for a company"""
        response = self.session.get(f"{BASE_URL}/api/companies/{DEMO_COMPANY_ID}/backups")
        
        assert response.status_code == 200, f"Get backups failed: {response.text}"
        
        data = response.json()
        assert "backups" in data, "Response should have 'backups' key"
        assert isinstance(data["backups"], list), "Backups should be a list"
        
        if len(data["backups"]) > 0:
            backup = data["backups"][0]
            assert "id" in backup, "Backup should have ID"
            assert "created_at" in backup, "Backup should have created_at"
            assert "status" in backup, "Backup should have status"
            # Verify no data field (too large)
            assert "data" not in backup or backup.get("data") is None, "Backup list should not include data"
            print(f"✓ Found {len(data['backups'])} backups")
        else:
            print("✓ No backups found (empty list)")
            
    def test_03_restore_backup(self):
        """Test restoring a backup"""
        # First get a backup to restore
        response = self.session.get(f"{BASE_URL}/api/companies/{DEMO_COMPANY_ID}/backups")
        assert response.status_code == 200
        
        backups = response.json().get("backups", [])
        if len(backups) == 0:
            pytest.skip("No backups available to restore")
            
        backup_id = backups[0]["id"]
        
        # Restore the backup
        response = self.session.post(f"{BASE_URL}/api/companies/{DEMO_COMPANY_ID}/backups/{backup_id}/restore")
        
        assert response.status_code == 200, f"Restore backup failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        print(f"✓ Backup {backup_id} restored successfully")
        
    def test_04_delete_backup(self):
        """Test deleting a backup"""
        # First create a new backup to delete
        response = self.session.post(f"{BASE_URL}/api/companies/{DEMO_COMPANY_ID}/backups")
        assert response.status_code == 200, f"Create backup for deletion failed: {response.text}"
        
        backup_id = response.json().get("id")
        
        # Delete the backup
        response = self.session.delete(f"{BASE_URL}/api/companies/{DEMO_COMPANY_ID}/backups/{backup_id}")
        
        assert response.status_code == 200, f"Delete backup failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        print(f"✓ Backup {backup_id} deleted successfully")
        
    def test_05_delete_nonexistent_backup_returns_404(self):
        """Test deleting non-existent backup returns 404"""
        fake_backup_id = "00000000-0000-0000-0000-000000000000"
        
        response = self.session.delete(f"{BASE_URL}/api/companies/{DEMO_COMPANY_ID}/backups/{fake_backup_id}")
        
        assert response.status_code == 404, f"Expected 404 for non-existent backup, got {response.status_code}"
        print("✓ Correctly returns 404 for non-existent backup")


class TestBackupAccessControl:
    """Test access control for backup APIs"""
    
    def test_01_clinic_admin_cannot_restore_backup(self):
        """Clinic admin should not be able to restore backups (super admin only)"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as clinic admin
        response = session.post(f"{BASE_URL}/api/auth/login", json=CLINIC_ADMIN_CREDENTIALS)
        assert response.status_code == 200, f"Clinic admin login failed: {response.text}"
        token = response.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get the company_id from the user
        user_response = session.get(f"{BASE_URL}/api/auth/me")
        company_id = user_response.json().get("company_id")
        
        if not company_id:
            pytest.skip("Clinic admin has no company_id")
        
        # First get backups
        response = session.get(f"{BASE_URL}/api/companies/{company_id}/backups")
        if response.status_code != 200:
            print(f"✓ Clinic admin cannot access backups - {response.status_code}")
            return
            
        backups = response.json().get("backups", [])
        if len(backups) == 0:
            pytest.skip("No backups to test restore access")
            
        # Try to restore - should fail (403)
        backup_id = backups[0]["id"]
        response = session.post(f"{BASE_URL}/api/companies/{company_id}/backups/{backup_id}/restore")
        
        assert response.status_code == 403, f"Expected 403 for clinic admin restore, got {response.status_code}"
        print("✓ Clinic admin correctly denied restore access (403)")


class TestNotificationSettingsAPIs:
    """Tests for Notification Settings functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as clinic admin (doctor@tebbi.com)
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=CLINIC_ADMIN_CREDENTIALS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get company_id from user
        user_response = self.session.get(f"{BASE_URL}/api/auth/me")
        self.company_id = user_response.json().get("company_id") or DEMO_COMPANY_ID
        
    def test_01_get_notification_settings(self):
        """Test getting notification settings for a company"""
        response = self.session.get(f"{BASE_URL}/api/companies/{self.company_id}/notification-settings")
        
        assert response.status_code == 200, f"Get settings failed: {response.text}"
        
        data = response.json()
        # Settings might be empty or have data
        assert isinstance(data, dict), "Response should be a dictionary"
        
        # If auth token exists, it should be masked
        if data.get("twilio_auth_token"):
            assert "•" in data["twilio_auth_token"], "Auth token should be masked"
            
        print(f"✓ Got notification settings (keys: {list(data.keys())})")
        
    def test_02_save_notification_settings(self):
        """Test saving notification settings"""
        settings = {
            "twilio_account_sid": "AC_TEST_SID_FOR_TESTING",
            "twilio_phone_number": "+1234567890",
            "whatsapp_number": "whatsapp:+1234567890",
            "sms_enabled": False,
            "whatsapp_enabled": False,
            "auto_reminder_enabled": True,
            "reminder_hours_before": 24,
            "reminder_channel": "sms",
            "templates": {
                "booking_confirmation": "تم تأكيد موعدك في {clinic_name}",
                "booking_reminder": "تذكير: لديك موعد غداً",
                "booking_cancelled": "تم إلغاء موعدك",
                "booking_completed": "شكراً لزيارتك"
            }
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/companies/{self.company_id}/notification-settings",
            json=settings
        )
        
        assert response.status_code == 200, f"Save settings failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        print("✓ Notification settings saved successfully")
        
    def test_03_verify_saved_settings(self):
        """Test that saved settings are persisted correctly"""
        response = self.session.get(f"{BASE_URL}/api/companies/{self.company_id}/notification-settings")
        
        assert response.status_code == 200
        
        data = response.json()
        # Verify saved values
        assert data.get("auto_reminder_enabled") == True, "auto_reminder_enabled should be True"
        assert data.get("reminder_hours_before") == 24, "reminder_hours_before should be 24"
        assert data.get("reminder_channel") == "sms", "reminder_channel should be sms"
        
        if data.get("templates"):
            assert "booking_confirmation" in data["templates"], "Templates should have booking_confirmation"
            
        print("✓ Settings persisted correctly")
        
    def test_04_update_reminder_settings(self):
        """Test updating auto reminder settings"""
        settings = {
            "auto_reminder_enabled": True,
            "reminder_hours_before": 48,
            "reminder_channel": "whatsapp"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/companies/{self.company_id}/notification-settings",
            json=settings
        )
        
        assert response.status_code == 200
        
        # Verify update
        response = self.session.get(f"{BASE_URL}/api/companies/{self.company_id}/notification-settings")
        data = response.json()
        
        assert data.get("reminder_hours_before") == 48, "reminder_hours_before should be updated to 48"
        assert data.get("reminder_channel") == "whatsapp", "reminder_channel should be updated to whatsapp"
        
        print("✓ Reminder settings updated successfully")
        
    def test_05_test_notification_connection_no_twilio(self):
        """Test notification connection test fails gracefully without Twilio keys"""
        # First clear any existing settings
        self.session.post(
            f"{BASE_URL}/api/companies/{self.company_id}/notification-settings",
            json={"twilio_account_sid": "", "twilio_auth_token": ""}
        )
        
        response = self.session.post(
            f"{BASE_URL}/api/companies/{self.company_id}/test-notification",
            json={"type": "sms"}
        )
        
        # Should fail with 400 (settings not configured)
        assert response.status_code == 400, f"Expected 400 for missing Twilio keys, got {response.status_code}"
        print("✓ Test notification correctly fails without Twilio credentials")


class TestNotificationSettingsAccessControl:
    """Test access control for notification settings"""
    
    def test_01_super_admin_can_access_any_company_settings(self):
        """Super admin should be able to access any company's notification settings"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        response = session.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN_CREDENTIALS)
        assert response.status_code == 200
        token = response.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Access demo company's notification settings
        response = session.get(f"{BASE_URL}/api/companies/{DEMO_COMPANY_ID}/notification-settings")
        
        assert response.status_code == 200, f"Super admin should access settings, got {response.status_code}"
        print("✓ Super admin can access any company's notification settings")
        
    def test_02_user_cannot_access_other_company_settings(self):
        """User should not be able to access another company's settings"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as clinic admin
        response = session.post(f"{BASE_URL}/api/auth/login", json=CLINIC_ADMIN_CREDENTIALS)
        assert response.status_code == 200
        token = response.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get user's company
        user_response = session.get(f"{BASE_URL}/api/auth/me")
        user_company = user_response.json().get("company_id")
        
        # Try to access a different company's settings
        fake_company = "00000000-0000-0000-0000-000000000000"
        if user_company != fake_company:
            response = session.get(f"{BASE_URL}/api/companies/{fake_company}/notification-settings")
            assert response.status_code == 403, f"Expected 403 for unauthorized access, got {response.status_code}"
            print("✓ User correctly denied access to other company's settings")
        else:
            pytest.skip("Cannot test - company IDs match")


class TestMessageTemplates:
    """Tests for message template functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=CLINIC_ADMIN_CREDENTIALS)
        assert response.status_code == 200
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        user_response = self.session.get(f"{BASE_URL}/api/auth/me")
        self.company_id = user_response.json().get("company_id") or DEMO_COMPANY_ID
        
    def test_01_save_custom_templates(self):
        """Test saving custom message templates"""
        templates = {
            "templates": {
                "booking_confirmation": "مرحباً {patient_name}، تم تأكيد موعدك في {clinic_name} يوم {date} الساعة {time}",
                "booking_reminder": "تذكير: موعدك غداً الساعة {time} مع د. {doctor_name}",
                "booking_cancelled": "عزيزي {patient_name}، تم إلغاء موعدك في {clinic_name}",
                "booking_completed": "شكراً لزيارتك {clinic_name}! رقم التأكيد: {confirmation_code}"
            }
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/companies/{self.company_id}/notification-settings",
            json=templates
        )
        
        assert response.status_code == 200
        
        # Verify templates are saved
        response = self.session.get(f"{BASE_URL}/api/companies/{self.company_id}/notification-settings")
        data = response.json()
        
        if data.get("templates"):
            saved_templates = data["templates"]
            assert "{patient_name}" in saved_templates.get("booking_confirmation", ""), "Template should contain variables"
            
        print("✓ Custom message templates saved successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
