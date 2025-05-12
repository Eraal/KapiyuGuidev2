from app.extensions import socketio, db
from flask_socketio import emit, join_room, leave_room
from flask_login import current_user
from app.models import (
    Notification, User, Office, OfficeAdmin, Inquiry, 
    CounselingSession, Student, AuditLog, InquiryMessage
)
from datetime import datetime

def init_socketio():
    """Register office socket event handlers"""
    
    @socketio.on('connect')
    def handle_connect():
        if not current_user.is_authenticated:
            return False
        
        # Join user-specific room
        join_room(f"user_{current_user.id}")
        
        # If office admin, join office room
        if current_user.role == 'office_admin' and current_user.office_admin:
            office_id = current_user.office_admin.office_id
            join_room(f"office_{office_id}")
            
            # Log connection
            print(f"Office admin {current_user.get_full_name()} joined office_{office_id} room")
            
            # Update online status
            current_user.is_online = True
            current_user.last_activity = datetime.utcnow()
            db.session.commit()
    
    @socketio.on('disconnect')
    def handle_disconnect():
        if not current_user.is_authenticated:
            return
        
        # If office admin, leave office room
        if current_user.role == 'office_admin' and current_user.office_admin:
            office_id = current_user.office_admin.office_id
            leave_room(f"office_{office_id}")
            
            # Update online status and last activity
            current_time = datetime.utcnow()
            current_user.is_online = False
            current_user.last_activity = current_time
            db.session.commit()
            
            # Update office login log to record logout time
            from app.models import OfficeLoginLog
            login_log = OfficeLoginLog.query.filter_by(
                office_admin_id=current_user.office_admin.id,
                logout_time=None
            ).order_by(OfficeLoginLog.login_time.desc()).first()
            
            if login_log:
                login_log.update_logout(current_time)
                db.session.commit()
            
            # Emit office admin offline status to office room
            emit('admin_status_change', {
                'admin_id': current_user.id,
                'admin_name': current_user.get_full_name(),
                'status': 'offline',
                'timestamp': current_time.strftime('%Y-%m-%d %H:%M:%S')
            }, room=f"office_{office_id}")
            
            # Also emit to super admin room for real-time updates
            emit('staff_status_update', {
                'user_id': current_user.id,
                'user_name': current_user.get_full_name(),
                'office_id': office_id,
                'status': 'offline',
                'timestamp': current_time.strftime('%Y-%m-%d %H:%M:%S')
            }, room='super_admin_room')