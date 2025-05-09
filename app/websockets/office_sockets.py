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
            
            # Emit office admin online status to office room
            emit('admin_status_change', {
                'admin_id': current_user.id,
                'admin_name': current_user.get_full_name(),
                'status': 'online',
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f"office_{office_id}")
    
    @socketio.on('disconnect')
    def handle_disconnect():
        if not current_user.is_authenticated:
            return
        
        # If office admin, leave office room
        if current_user.role == 'office_admin' and current_user.office_admin:
            office_id = current_user.office_admin.office_id
            leave_room(f"office_{office_id}")
            
            # Update online status
            current_user.is_online = False
            current_user.last_activity = datetime.utcnow()
            db.session.commit()
            
            # Emit office admin offline status to office room
            emit('admin_status_change', {
                'admin_id': current_user.id,
                'admin_name': current_user.get_full_name(),
                'status': 'offline',
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f"office_{office_id}")
    
    # New chat message handlers for office admins
    @socketio.on('chat_message_sent')
    def handle_chat_message_sent(data):
        """Handle when an office admin sends a new chat message"""
        if not current_user.is_authenticated or current_user.role != 'office_admin':
            return
        
        inquiry_id = data.get('inquiry_id')
        message_id = data.get('message_id')
        student_id = data.get('student_id')
        
        # Get the inquiry
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return
        
        # Emit to student that a new message was sent
        if student_id and inquiry_id and message_id:
            emit('new_chat_message', {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'sender_id': current_user.id,
                'sender_name': current_user.get_full_name(),
                'content': data.get('content', ''),
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                'status': 'sent'
            }, room=f'user_{student_id}')
            
            # Also emit a sent confirmation back to the sender
            emit('message_status_update', {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'status': 'sent',
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f'user_{current_user.id}')
    
    @socketio.on('chat_message_delivered')
    def handle_chat_message_delivered(data):
        """Handle when a chat message is delivered to recipient"""
        if not current_user.is_authenticated:
            return
        
        inquiry_id = data.get('inquiry_id')
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        
        # Update message status in database
        message = InquiryMessage.query.get(message_id)
        if message:
            message.delivered_at = datetime.utcnow()
            db.session.commit()
            
            # Emit to sender that message was delivered
            emit('message_status_update', {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'status': 'delivered',
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f'user_{sender_id}')
    
    @socketio.on('chat_message_read')
    def handle_chat_message_read(data):
        """Handle when a chat message is read by recipient"""
        if not current_user.is_authenticated:
            return
        
        inquiry_id = data.get('inquiry_id')
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        
        # Update message status in database
        message = InquiryMessage.query.get(message_id)
        if message:
            message.read_at = datetime.utcnow()
            db.session.commit()
            
            # Emit to sender that message was read
            emit('message_status_update', {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'status': 'read',
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f'user_{sender_id}')
    
    @socketio.on('typing_indicator')
    def on_typing(data):
        """Handle typing indicators for office admins"""
        if not current_user.is_authenticated or current_user.role != 'office_admin':
            return
            
        inquiry_id = data.get('inquiry_id')
        student_id = data.get('student_id')
        is_typing = data.get('is_typing', False)
        
        if student_id and inquiry_id:
            # Office admin typing, notify student
            emit('user_typing', {
                'inquiry_id': inquiry_id,
                'user_id': current_user.id,
                'user_name': current_user.get_full_name(),
                'is_typing': is_typing
            }, room=f'student_{student_id}')

def emit_new_inquiry_notification(inquiry):
    """
    Emit a real-time notification when a new inquiry is created.
    This should be called when a student submits an inquiry.
    
    :param inquiry: The Inquiry object that was just created
    """
    if not inquiry:
        return
        
    # Get student name
    student = User.query.join(Student).filter(Student.id == inquiry.student_id).first()
    student_name = student.get_full_name() if student else "Unknown Student"
    
    # Get office
    office = Office.query.get(inquiry.office_id)
    
    if not office:
        return
        
    # Emit to office room
    socketio.emit('new_inquiry', {
        'inquiry_id': inquiry.id,
        'student_id': inquiry.student_id,
        'student_name': student_name,
        'office_id': inquiry.office_id,
        'office_name': office.name,
        'subject': inquiry.subject,
        'status': inquiry.status,
        'timestamp': inquiry.created_at.strftime('%Y-%m-%d %H:%M:%S')
    }, room=f"office_{inquiry.office_id}")
    
    # Create notifications for all office admins
    office_admins = User.query.join(OfficeAdmin).filter(OfficeAdmin.office_id == inquiry.office_id).all()
    
    for admin in office_admins:
        notification = Notification(
            user_id=admin.id,
            title="New Student Inquiry",
            message=f"{student_name} has submitted a new inquiry: {inquiry.subject}",
            is_read=False
        )
        db.session.add(notification)
    
    db.session.commit()
    
    # Log activity
    AuditLog.log_action(
        actor=student,
        action="Submitted Inquiry",
        target_type="inquiry",
        inquiry=inquiry,
        office=office,
        status=inquiry.status,
        is_success=True
    )

def emit_new_counseling_request(session):
    """
    Emit a real-time notification when a new counseling session is requested.
    This should be called when a student requests a counseling session.
    
    :param session: The CounselingSession object that was just created
    """
    if not session:
        return
        
    # Get student name
    student = User.query.join(Student).filter(Student.id == session.student_id).first()
    student_name = student.get_full_name() if student else "Unknown Student"
    
    # Get office
    office = Office.query.get(session.office_id)
    
    if not office:
        return
        
    # Emit to office room
    socketio.emit('new_counseling_request', {
        'session_id': session.id,
        'student_id': session.student_id,
        'student_name': student_name,
        'office_id': session.office_id,
        'office_name': office.name,
        'counselor_id': session.counselor_id,
        'scheduled_at': session.scheduled_at.strftime('%Y-%m-%d %H:%M:%S'),
        'status': session.status,
        'is_video': session.is_video_session,
        'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    }, room=f"office_{session.office_id}")
    
    # Create notifications for all office admins
    office_admins = User.query.join(OfficeAdmin).filter(OfficeAdmin.office_id == session.office_id).all()
    
    for admin in office_admins:
        notification = Notification(
            user_id=admin.id,
            title="New Counseling Request",
            message=f"{student_name} has requested a counseling session on {session.scheduled_at.strftime('%b %d, %Y at %H:%M')}",
            is_read=False
        )
        db.session.add(notification)
    
    db.session.commit()
    
    # Log activity
    AuditLog.log_action(
        actor=student,
        action="Requested Counseling",
        target_type="counseling_session",
        office=office,
        status=session.status,
        is_success=True
    )

def emit_inquiry_status_update(inquiry, updated_by):
    """
    Emit a real-time notification when an inquiry status is updated.
    
    :param inquiry: The updated Inquiry object
    :param updated_by: User who updated the inquiry
    """
    if not inquiry:
        return
        
    # Get student
    student = User.query.join(Student).filter(Student.id == inquiry.student_id).first()
    
    if not student:
        return
        
    # Emit to student's room for real-time updates
    socketio.emit('inquiry_status_changed', {
        'inquiry_id': inquiry.id,
        'status': inquiry.status,
        'updated_by': updated_by.get_full_name() if updated_by else "System",
        'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    }, room=f"user_{student.id}")
    
    # Also emit to office room for syncing other admin's views
    socketio.emit('inquiry_status_changed', {
        'inquiry_id': inquiry.id,
        'office_id': inquiry.office_id,
        'status': inquiry.status,
        'updated_by': updated_by.get_full_name() if updated_by else "System",
        'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    }, room=f"office_{inquiry.office_id}")
    
    # Create notification for student
    status_text = inquiry.status.capitalize()
    notification = Notification(
        user_id=student.id,
        title=f"Inquiry {status_text}",
        message=f"Your inquiry has been marked as {status_text}.",
        is_read=False
    )
    db.session.add(notification)
    db.session.commit()
    
    # Log activity
    AuditLog.log_action(
        actor=updated_by,
        action=f"Updated Inquiry Status to {inquiry.status}",
        target_type="inquiry",
        inquiry=inquiry,
        office=inquiry.office,
        status=inquiry.status,
        is_success=True
    )

def emit_counseling_status_update(session, updated_by):
    """
    Emit a real-time notification when a counseling session status is updated.
    
    :param session: The updated CounselingSession object
    :param updated_by: User who updated the session
    """
    if not session:
        return
        
    # Get student
    student = User.query.join(Student).filter(Student.id == session.student_id).first()
    
    if not student:
        return
        
    # Emit to student's room for real-time updates
    socketio.emit('counseling_session_update', {
        'session_id': session.id,
        'status': session.status,
        'updated_by': updated_by.get_full_name() if updated_by else "System",
        'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    }, room=f"user_{student.id}")
    
    # Also emit to office room for syncing other admin's views
    socketio.emit('counseling_session_update', {
        'session_id': session.id,
        'office_id': session.office_id,
        'status': session.status,
        'updated_by': updated_by.get_full_name() if updated_by else "System",
        'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    }, room=f"office_{session.office_id}")
    
    # Create notification for student
    status_text = session.status.capitalize()
    session_time = session.scheduled_at.strftime('%b %d at %H:%M')
    
    notification = Notification(
        user_id=student.id,
        title=f"Counseling Session {status_text}",
        message=f"Your counseling session scheduled for {session_time} has been {status_text.lower()}.",
        is_read=False
    )
    db.session.add(notification)
    db.session.commit()
    
    # Log activity
    AuditLog.log_action(
        actor=updated_by,
        action=f"Updated Counseling Session Status to {session.status}",
        target_type="counseling_session",
        office=session.office,
        status=session.status,
        is_success=True
    )

def emit_office_reply(message):
    """
    Emit event when an office admin replies to an inquiry.
    This should be called from routes when an office admin sends a reply.
    
    :param message: The InquiryMessage object that was just created
    """
    if not message:
        return
    
    # Get the inquiry
    inquiry = Inquiry.query.get(message.inquiry_id)
    if not inquiry:
        return
    
    # Get the student user for this inquiry
    student = Student.query.get(inquiry.student_id)
    if not student or not student.user_id:
        return
    
    # Emit to student's room
    socketio.emit('new_message', {
        'message_id': message.id,
        'inquiry_id': inquiry.id,
        'sender_id': message.sender_id,
        'sender_name': message.sender.get_full_name(),
        'content': message.content,
        'status': message.status,
        'created_at': message.created_at.isoformat(),
    }, room=f"user_{student.user_id}")
    
    # Also emit to the inquiry room
    socketio.emit('new_message', {
        'message_id': message.id,
        'inquiry_id': inquiry.id,
        'sender_id': message.sender_id,
        'sender_name': message.sender.get_full_name(),
        'content': message.content,
        'status': message.status,
        'created_at': message.created_at.isoformat(),
    }, room=f"inquiry_{inquiry.id}", include_self=False)
    
    # Update message status to delivered since we know it's been sent
    message.status = 'delivered'
    message.delivered_at = datetime.utcnow()
    db.session.commit()