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
            
    @socketio.on('join_inquiry_room')
    def join_inquiry_room(data):
        """Allow office admins to join rooms for specific inquiries"""
        if not current_user.is_authenticated or current_user.role != 'office_admin':
            return
            
        inquiry_id = data.get('inquiry_id')
        if not inquiry_id:
            return
            
        # Join the inquiry-specific room
        room_name = f'inquiry_{inquiry_id}'
        join_room(room_name)
        print(f"Office admin {current_user.id} joined inquiry room: {room_name}")
        emit('joined_inquiry_room', {'status': 'success', 'room': room_name})
            
    @socketio.on('chat_message_sent')
    def handle_chat_message(data):
        """Handle when an office admin sends a chat message"""
        if not current_user.is_authenticated or current_user.role != 'office_admin':
            return
            
        inquiry_id = data.get('inquiry_id')
        message_id = data.get('message_id')
        student_id = data.get('student_id')
        content = data.get('content', '')
        
        print(f"DEBUG: Office admin {current_user.id} sent message {message_id} to student {student_id} in inquiry {inquiry_id}")
        
        # Emit to student
        if student_id:
            student = Student.query.get(student_id)
            if student:
                student_user = User.query.get(student.user_id)
                if student_user:
                    # Get office name
                    office_name = "Office"
                    if current_user.office_admin:
                        office = Office.query.get(current_user.office_admin.office_id)
                        if office:
                            office_name = office.name
                    
                    # Emit to student's personal room
                    emit('new_chat_message', {
                        'inquiry_id': inquiry_id,
                        'message_id': message_id,
                        'sender_id': current_user.id,
                        'sender_name': current_user.get_full_name(),
                        'content': content,
                        'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                        'from_admin': True,
                        'office_name': office_name,
                        'status': 'sent'
                    }, room=f'user_{student_user.id}')
                    
                    print(f"DEBUG: Message {message_id} emitted to student user room: user_{student_user.id}")
        
        # Also emit to the inquiry room for other office admins
        room_name = f'inquiry_{inquiry_id}'
        emit('new_chat_message', {
            'inquiry_id': inquiry_id,
            'message_id': message_id,
            'sender_id': current_user.id,
            'sender_name': current_user.get_full_name(),
            'content': content,
            'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
            'is_admin': True,
            'status': 'sent'
        }, room=room_name, include_self=False)  # Don't send back to sender
        
        print(f"DEBUG: Message {message_id} also emitted to inquiry room: {room_name}")
            
    @socketio.on('staff_status')
    def handle_staff_status(data):
        """Handle staff status updates (online, away, idle)"""
        if not current_user.is_authenticated or current_user.role != 'office_admin':
            return
            
        user_id = data.get('user_id')
        office_id = data.get('office_id')
        status = data.get('status')
        
        # Validate it's the same user or a supervisor
        if user_id != current_user.id and current_user.role != 'super_admin':
            return
            
        # Update status in the database
        user = User.query.get(user_id)
        if user:
            if status == 'online':
                user.is_online = True
            elif status == 'offline':
                user.is_online = False
                
            user.last_activity = datetime.utcnow()
            db.session.commit()
            
        # Emit to office room
        emit('staff_status_update', {
            'user_id': user_id,
            'status': status,
            'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        }, room=f'office_{office_id}')
        
    @socketio.on('typing_indicator')
    def handle_typing_indicator(data):
        """Handle typing indicator events from office admins"""
        if not current_user.is_authenticated or current_user.role != 'office_admin':
            return
            
        inquiry_id = data.get('inquiry_id')
        student_id = data.get('student_id')
        is_typing = data.get('is_typing', False)
        
        print(f"DEBUG: Office admin {current_user.id} typing status: {is_typing} for inquiry {inquiry_id}")
        
        if not inquiry_id:
            return
            
        # Prepare typing data
        typing_data = {
            'inquiry_id': inquiry_id,
            'office_admin_id': current_user.id,
            'admin_name': current_user.get_full_name(),
            'is_typing': is_typing
        }
        
        # Emit to student
        if student_id:
            student = Student.query.get(student_id)
            if student and student.user_id:
                emit('admin_typing', typing_data, room=f'user_{student.user_id}')
                print(f"DEBUG: Typing indicator sent to student user_{student.user_id}")
                
        # Also emit to other admins in the inquiry room for awareness
        emit('admin_typing', typing_data, room=f'inquiry_{inquiry_id}', include_self=False)
        print(f"DEBUG: Typing indicator also sent to inquiry_{inquiry_id}")

def emit_office_reply(message):
    """
    Emit event when an office admin replies to an inquiry.
    This can be called from routes to trigger real-time updates.
    
    :param message: The InquiryMessage object that was just created
    """
    if not message:
        return
    
    # Get the inquiry
    inquiry = Inquiry.query.get(message.inquiry_id)
    if not inquiry:
        return
    
    # Get sender details
    sender = User.query.get(message.sender_id)
    if not sender or sender.role != 'office_admin':
        return
    
    # Get student
    student = Student.query.get(inquiry.student_id)
    if not student or not student.user_id:
        return
    
    student_user = User.query.get(student.user_id)
    if not student_user:
        return
    
    # Get office name
    office_name = "Office"
    office_admin = OfficeAdmin.query.filter_by(user_id=sender.id).first()
    if office_admin:
        office = Office.query.get(office_admin.office_id)
        if office:
            office_name = office.name
    
    # Emit to student's personal room
    print(f"DEBUG: Emitting office reply from {sender.id} to student {student_user.id} for inquiry {inquiry.id}")
    
    socketio.emit('new_chat_message', {
        'inquiry_id': inquiry.id,
        'message_id': message.id,
        'sender_id': sender.id,
        'sender_name': sender.get_full_name(),
        'content': message.content,
        'timestamp': message.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        'from_admin': True,
        'office_name': office_name,
        'status': 'sent'
    }, room=f'user_{student_user.id}')
    
    # Also emit to the inquiry room for other office admins
    socketio.emit('new_chat_message', {
        'inquiry_id': inquiry.id, 
        'message_id': message.id,
        'sender_id': sender.id,
        'sender_name': sender.get_full_name(),
        'content': message.content,
        'timestamp': message.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        'is_admin': True,
        'status': 'sent'
    }, room=f'inquiry_{inquiry.id}')