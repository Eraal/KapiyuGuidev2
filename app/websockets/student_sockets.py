from app.extensions import socketio
from flask_login import current_user
from flask_socketio import emit, join_room
from datetime import datetime
from app.models import Inquiry, InquiryMessage, User, Student, Office, OfficeAdmin
from app import db

def init_socketio():
    """Register student socket event handlers"""
    
    @socketio.on('join')
    def on_join(data):
        """Handle join room events for students"""
        if not current_user.is_authenticated or current_user.role != 'student':
            return
            
        # Join personal room for this student
        room = data.get('room')
        if room:
            join_room(room)
            emit('status', {'msg': f'Joined room: {room}'}, room=room)
    
    @socketio.on('connect')
    def on_connect():
        """Handle connection events for students"""
        if current_user.is_authenticated and current_user.role == 'student':
            # Join student's personal room based on user ID
            user_room = f'student_{current_user.id}'
            join_room(user_room)
            
            # Also join the general student room
            join_room('student_room')
            emit('status', {'msg': 'Connected to student socket'}, room=user_room)
    
    @socketio.on('read_notification')
    def on_read_notification(data):
        """Handle notification read events"""
        if not current_user.is_authenticated or current_user.role != 'student':
            return
            
        notification_id = data.get('notification_id')
        # Emit to client that notification was read
        # This will be handled in the client-side JavaScript
        emit('notification_read', {'notification_id': notification_id}, room=f'student_{current_user.id}')
    
    @socketio.on('inquiry_activity')
    def on_inquiry_activity(data):
        """Handle inquiry update activities from student"""
        if not current_user.is_authenticated or current_user.role != 'student':
            return
            
        # When a student adds a reply to an inquiry, notify office admins
        inquiry_id = data.get('inquiry_id')
        office_id = data.get('office_id')
        action = data.get('action', 'updated')
        
        # Forward to office room
        if office_id:
            emit('student_inquiry_update', {
                'inquiry_id': inquiry_id,
                'student_id': current_user.id,
                'student_name': f"{current_user.first_name} {current_user.last_name}",
                'action': action
            }, room=f'office_{office_id}')
    
    # New chat message status handlers
    @socketio.on('chat_message_sent')
    def on_chat_message_sent(data):
        """Handle when a student sends a new chat message"""
        if not current_user.is_authenticated or current_user.role != 'student':
            return
            
        inquiry_id = data.get('inquiry_id')
        message_id = data.get('message_id')
        office_id = data.get('office_id')
        
        # Emit to office admins that a new message was sent
        if office_id and inquiry_id and message_id:
            emit('new_chat_message', {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'sender_id': current_user.id,
                'sender_name': current_user.get_full_name(),
                'content': data.get('content', ''),
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                'status': 'sent'
            }, room=f'office_{office_id}')
            
            # Also emit a sent confirmation back to the sender
            emit('message_status_update', {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'status': 'sent',
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f'student_{current_user.id}')
    
    @socketio.on('chat_message_delivered')
    def on_chat_message_delivered(data):
        """Handle when a chat message is delivered to recipient"""
        if not current_user.is_authenticated:
            return
            
        inquiry_id = data.get('inquiry_id')
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        
        if inquiry_id and message_id and sender_id:
            # Emit to sender that message was delivered
            emit('message_status_update', {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'status': 'delivered',
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f'user_{sender_id}')
    
    @socketio.on('chat_message_read')
    def on_chat_message_read(data):
        """Handle when a chat message is read by recipient"""
        if not current_user.is_authenticated:
            return
            
        inquiry_id = data.get('inquiry_id')
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        
        if inquiry_id and message_id and sender_id:
            # Emit to sender that message was read
            emit('message_status_update', {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'status': 'read',
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f'user_{sender_id}')
    
    @socketio.on('typing_indicator')
    def on_typing(data):
        """Handle typing indicators"""
        if not current_user.is_authenticated:
            return
            
        inquiry_id = data.get('inquiry_id')
        office_id = data.get('office_id')
        is_typing = data.get('is_typing', False)
        
        if current_user.role == 'student':
            # Student typing, notify office
            if office_id:
                emit('user_typing', {
                    'inquiry_id': inquiry_id,
                    'user_id': current_user.id,
                    'user_name': current_user.get_full_name(),
                    'is_typing': is_typing
                }, room=f'office_{office_id}')
        else:
            # Office admin typing, notify student
            student_id = data.get('student_id')
            if student_id:
                emit('user_typing', {
                    'inquiry_id': inquiry_id,
                    'user_id': current_user.id,
                    'user_name': current_user.get_full_name(),
                    'is_typing': is_typing
                }, room=f'student_{student_id}')
    
    @socketio.on('typing_indicator')
    def on_typing_indicator(data):
        """Broadcast typing indicator to the other party in a chat"""
        if not current_user.is_authenticated:
            return
        
        inquiry_id = data.get('inquiry_id')
        is_typing = data.get('is_typing', False)
        
        if not inquiry_id:
            return
        
        # Get the inquiry to find the relevant office
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            return
        
        # Broadcast to office room if student is typing
        if current_user.role == 'student':
            room = f'office_{inquiry.office_id}'
            emit('user_typing', {
                'inquiry_id': inquiry_id,
                'user_id': current_user.id,
                'user_name': current_user.get_full_name(),
                'is_typing': is_typing
            }, room=room)
        
        # Broadcast to student if office admin is typing
        elif current_user.role == 'office_admin':
            student = User.query.join(Student).filter(Student.id == inquiry.student_id).first()
            if student:
                room = f'user_{student.id}'
                emit('user_typing', {
                    'inquiry_id': inquiry_id,
                    'user_id': current_user.id,
                    'user_name': current_user.get_full_name(),
                    'is_typing': is_typing
                }, room=room)
    
    @socketio.on('message_status')
    def on_message_status(data):
        """Update message status (delivered, read)"""
        if not current_user.is_authenticated:
            return
        
        message_id = data.get('message_id')
        status = data.get('status')  # 'delivered' or 'read'
        
        if not message_id or not status:
            return
        
        # Get the message
        message = InquiryMessage.query.get(message_id)
        
        if not message:
            return
        
        # Update message status
        if status == 'delivered':
            message.delivered_at = datetime.utcnow()
        elif status == 'read':
            message.read_at = datetime.utcnow()
        
        db.session.commit()
        
        # Notify sender about status update
        if message.sender_id != current_user.id:
            emit('message_status_update', {
                'message_id': message_id,
                'status': status,
                'timestamp': datetime.utcnow().isoformat()
            }, room=f'user_{message.sender_id}')

def emit_inquiry_reply(message):
    """
    Emit event when a new message is added to an inquiry.
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
    if not sender:
        return
    
    # Determine target room based on sender role
    if sender.role == 'student':
        # Message from student to office
        socketio.emit('new_inquiry_message', {
            'inquiry_id': inquiry.id,
            'message_id': message.id,
            'sender_id': sender.id,
            'sender_name': sender.get_full_name(),
            'content': message.content,
            'timestamp': message.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'status': 'sent'
        }, room=f'office_{inquiry.office_id}')
    else:
        # Message from office to student
        # Get student
        student = Student.query.get(inquiry.student_id)
        if student:
            student_user = User.query.get(student.user_id)
            if student_user:
                socketio.emit('new_inquiry_message', {
                    'inquiry_id': inquiry.id,
                    'message_id': message.id,
                    'sender_id': sender.id,
                    'sender_name': sender.get_full_name(),
                    'content': message.content,
                    'timestamp': message.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    'status': 'sent'
                }, room=f'student_{student_user.id}')