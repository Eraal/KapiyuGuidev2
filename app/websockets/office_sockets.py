from app.extensions import socketio, db
from flask_socketio import emit, join_room, leave_room
from flask_login import current_user
from app.models import (
    Notification, User, Office, OfficeAdmin, Inquiry, 
    CounselingSession, Student, AuditLog, InquiryMessage
)
from datetime import datetime
import json

def init_socketio():
    """Register office admin socket event handlers"""
    
    @socketio.on('join')
    def on_join(data):
        """Handle join room events for office admins"""
        print(f"DEBUG [OFFICE]: Join room event: {json.dumps(data)}")
        if not current_user.is_authenticated or current_user.role != 'office_admin':
            print(f"DEBUG [OFFICE]: Unauthorized join attempt: {current_user.id if current_user.is_authenticated else 'Not authenticated'}")
            return
            
        # Join room requested
        room = data.get('room')
        if room:
            join_room(room)
            print(f"DEBUG [OFFICE]: Admin {current_user.id} joined room: {room}")
    
    @socketio.on('connect')
    def on_connect():
        """Handle connection events for office admins"""
        print(f"DEBUG [OFFICE]: Socket connection: {current_user.id if current_user.is_authenticated else 'Not authenticated'}")
        if current_user.is_authenticated and current_user.role == 'office_admin':
            # Join admin's personal room based on user ID
            user_room = f'user_{current_user.id}'
            join_room(user_room)
            print(f"DEBUG [OFFICE]: Joined personal room: {user_room}")
            
            # Also join the office room for this admin
            if current_user.office_admin and current_user.office_admin.office_id:
                office_room = f'office_{current_user.office_admin.office_id}'
                join_room(office_room)
                print(f"DEBUG [OFFICE]: Joined office room: {office_room}")
                
                # Send connection confirmation
                emit('status', {'msg': 'Connected to office socket'}, room=user_room)
                
                # Notify everyone in office room that this admin is online
                emit('staff_status_update', {
                    'user_id': current_user.id,
                    'office_id': current_user.office_admin.office_id,
                    'status': 'online',
                    'username': current_user.get_full_name(),
                    'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
                }, room=office_room)
                print(f"DEBUG [OFFICE]: Emitted staff_status_update to {office_room}")
    
    @socketio.on('disconnect')
    def on_disconnect():
        """Handle disconnect events"""
        print(f"DEBUG [OFFICE]: Socket disconnected: {current_user.id if current_user.is_authenticated else 'Not authenticated'}")
        
        # If this is an office admin, update their status to offline
        if current_user.is_authenticated and current_user.role == 'office_admin' and current_user.office_admin:
            office_room = f'office_{current_user.office_admin.office_id}'
            emit('staff_status_update', {
                'user_id': current_user.id,
                'office_id': current_user.office_admin.office_id,
                'status': 'offline',
                'username': current_user.get_full_name(),
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=office_room)
            print(f"DEBUG [OFFICE]: Emitted offline status to {office_room}")
    
    @socketio.on('chat_message_sent')
    def on_chat_message_sent(data):
        """Handle when an office admin sends a new chat message"""
        print(f"DEBUG [OFFICE]: chat_message_sent received: {json.dumps(data)}")
        
        if not current_user.is_authenticated or current_user.role != 'office_admin':
            print(f"DEBUG [OFFICE]: Unauthorized chat_message_sent access: {current_user.id if current_user.is_authenticated else 'Not authenticated'}")
            return
            
        inquiry_id = data.get('inquiry_id')
        message_id = data.get('message_id')
        content = data.get('content')
        student_id = data.get('student_id')
        
        print(f"DEBUG [OFFICE]: Admin {current_user.id} sending message for inquiry {inquiry_id} to student {student_id}")
        
        # Basic validation
        if not inquiry_id or not content or not student_id:
            print(f"DEBUG [OFFICE]: Missing required data for chat message")
            return
            
        # Check if the inquiry belongs to this admin's office
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            print(f"DEBUG [OFFICE]: Invalid inquiry_id: {inquiry_id}")
            return
            
        # Verify access to this inquiry
        if not current_user.office_admin or inquiry.office_id != current_user.office_admin.office_id:
            # This might not be an error - could be a case where admin was reassigned
            print(f"DEBUG [OFFICE]: Admin {current_user.id} might not have direct access to inquiry {inquiry_id}")
        
        # Verify student is the correct one for this inquiry
        student = Student.query.get(inquiry.student_id)
        if not student or student.id != int(student_id):
            print(f"DEBUG [OFFICE]: Student {student_id} doesn't match inquiry's student {inquiry.student_id}")
            return
        
        # If message_id isn't provided, this could be a real-time notification before DB save
        # In this case, create a temporary ID
        if not message_id:
            from uuid import uuid4
            message_id = f'temp_{str(uuid4())}'
            print(f"DEBUG [OFFICE]: Created temporary message_id: {message_id}")
        
        # Save to database
        try:
            new_message = InquiryMessage(
                inquiry_id=inquiry_id,
                sender_id=current_user.id,
                content=content
            )
            db.session.add(new_message)
            db.session.commit()
            message_id = new_message.id
            print(f"DEBUG [OFFICE]: Saved message to database with ID: {message_id}")
        except Exception as e:
            print(f"DEBUG [OFFICE]: Error saving message to database: {str(e)}")
            db.session.rollback()
            return
            
        # Get office name for the message
        office_name = "Office"
        if current_user.office_admin:
            office = Office.query.get(current_user.office_admin.office_id)
            if office:
                office_name = office.name
        
        # Find the student user
        student_user = User.query.join(Student).filter(Student.id == student_id).first()
        if not student_user:
            print(f"DEBUG [OFFICE]: Could not find user for student {student_id}")
            return
            
        # Create message payload
        message_data = {
            'inquiry_id': inquiry_id,
            'message_id': message_id,
            'sender_id': current_user.id,
            'sender_name': current_user.get_full_name(),
            'content': content,
            'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
            'office_id': current_user.office_admin.office_id if current_user.office_admin else None,
            'office_name': office_name,
            'student_id': student_id,
            'from_admin': True
        }
        
        # Send to the student (try all relevant event types)
        emit('new_chat_message', message_data, room=f'user_{student_user.id}')
        print(f"DEBUG [OFFICE]: Emitted new_chat_message to user_{student_user.id}")
        
        emit('new_message', message_data, room=f'user_{student_user.id}')
        print(f"DEBUG [OFFICE]: Emitted new_message to user_{student_user.id}")
        
        # Also send to the inquiry room for other admins viewing the same inquiry
        emit('new_chat_message', message_data, room=f'inquiry_{inquiry_id}')
        print(f"DEBUG [OFFICE]: Emitted new_chat_message to inquiry_{inquiry_id}")
        
        # Also send to the office room so other admins can see
        office_id = current_user.office_admin.office_id if current_user.office_admin else None
        if office_id:
            emit('admin_message_sent', message_data, room=f'office_{office_id}')
            print(f"DEBUG [OFFICE]: Emitted admin_message_sent to office_{office_id}")
        
        # Send a confirmation to the sender
        emit('message_status_update', {
            'inquiry_id': inquiry_id,
            'message_id': message_id,
            'status': 'sent',
            'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        }, room=f'user_{current_user.id}')
        print(f"DEBUG [OFFICE]: Sent confirmation to user_{current_user.id}")
        
        # Also update the admin's UI with their own message to ensure it appears
        emit('new_chat_message', {
            'inquiry_id': inquiry_id,
            'message_id': message_id,
            'sender_id': current_user.id,
            'sender_name': current_user.get_full_name(),
            'content': content,
            'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
            'from_admin': True,
            'status': 'sent'
        }, room=f'user_{current_user.id}')
        print(f"DEBUG [OFFICE]: Sent admin's own message back to their UI")
    
    @socketio.on('chat_message_delivered')
    def on_chat_message_delivered(data):
        """Handle when a chat message is delivered to recipient"""
        print(f"DEBUG [OFFICE]: chat_message_delivered received: {json.dumps(data)}")
        
        if not current_user.is_authenticated:
            return
            
        inquiry_id = data.get('inquiry_id')
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        
        if inquiry_id and message_id and sender_id:
            # Update message status in database
            message = InquiryMessage.query.get(message_id)
            if message:
                message.delivered_at = datetime.utcnow()
                message.status = 'delivered'
                db.session.commit()
                print(f"DEBUG [OFFICE]: Updated message {message_id} status to 'delivered' in database")
            
            # Emit to sender that message was delivered
            emit('message_status_update', {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'status': 'delivered',
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f'user_{sender_id}')
            print(f"DEBUG [OFFICE]: Emitted message_status_update (delivered) to user_{sender_id}")
    
    @socketio.on('chat_message_read')
    def on_chat_message_read(data):
        """Handle when a chat message is read by recipient"""
        print(f"DEBUG [OFFICE]: chat_message_read received: {json.dumps(data)}")
        
        if not current_user.is_authenticated:
            return
            
        inquiry_id = data.get('inquiry_id')
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        
        if inquiry_id and message_id and sender_id:
            # Update message status in database
            message = InquiryMessage.query.get(message_id)
            if message:
                message.read_at = datetime.utcnow()
                message.status = 'read'
                db.session.commit()
                print(f"DEBUG [OFFICE]: Updated message {message_id} status to 'read' in database")
            
            # Emit to sender that message was read
            emit('message_status_update', {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'status': 'read',
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f'user_{sender_id}')
            print(f"DEBUG [OFFICE]: Emitted message_status_update (read) to user_{sender_id}")
    
    @socketio.on('join_inquiry_room')
    def on_join_inquiry_room(data):
        """Join an inquiry-specific room for real-time updates"""
        print(f"DEBUG [OFFICE]: join_inquiry_room event: {json.dumps(data)}")
        
        if not current_user.is_authenticated:
            print(f"DEBUG [OFFICE]: Unauthorized join_inquiry_room attempt")
            return
            
        inquiry_id = data.get('inquiry_id')
        if not inquiry_id:
            print(f"DEBUG [OFFICE]: No inquiry_id in join_inquiry_room data")
            return
            
        # For office admins, verify they have access to this inquiry
        if current_user.role == 'office_admin':
            inquiry = Inquiry.query.get(inquiry_id)
            if not inquiry:
                print(f"DEBUG [OFFICE]: Invalid inquiry_id: {inquiry_id}")
                return
                
            if not current_user.office_admin or inquiry.office_id != current_user.office_admin.office_id:
                print(f"DEBUG [OFFICE]: Admin {current_user.id} not authorized for inquiry {inquiry_id}")
                return
        
        # For students, verify it's their inquiry
        elif current_user.role == 'student':
            inquiry = Inquiry.query.get(inquiry_id)
            if not inquiry or inquiry.student_id != current_user.student.id:
                print(f"DEBUG [OFFICE]: Student {current_user.id} not authorized for inquiry {inquiry_id}")
                return
        
        # Join inquiry-specific room
        room = f'inquiry_{inquiry_id}'
        join_room(room)
        print(f"DEBUG [OFFICE]: {current_user.role} {current_user.id} joined {room}")
        
        # Also join a room specifically for viewing this inquiry
        view_room = f'inquiry_view_{inquiry_id}'
        join_room(view_room)
        print(f"DEBUG [OFFICE]: {current_user.role} {current_user.id} joined {view_room}")
    
    @socketio.on('typing_indicator')
    def on_typing_indicator(data):
        """Handle typing indicators between office admins and students"""
        print(f"DEBUG [OFFICE]: typing_indicator received: {json.dumps(data)}")
        
        if not current_user.is_authenticated:
            print(f"DEBUG [OFFICE]: Unauthorized typing_indicator access")
            return
            
        inquiry_id = data.get('inquiry_id')
        student_id = data.get('student_id')
        is_typing = data.get('is_typing', False)
        
        # Office admin typing to student
        if current_user.role == 'office_admin' and student_id:
            print(f"DEBUG [OFFICE]: Admin {current_user.id} typing to student {student_id}")
            
            # Find the student user
            student_user = User.query.join(Student).filter(Student.id == student_id).first()
            if student_user:
                # Send typing event to the student
                emit('admin_typing', {
                    'inquiry_id': inquiry_id,
                    'office_admin_id': current_user.id,
                    'admin_name': current_user.get_full_name(),
                    'is_typing': is_typing
                }, room=f'user_{student_user.id}')
                print(f"DEBUG [OFFICE]: Emitted admin_typing to user_{student_user.id}")
                
                # Also emit traditional typing event
                emit('user_typing', {
                    'inquiry_id': inquiry_id,
                    'user_id': current_user.id,
                    'user_name': current_user.get_full_name(),
                    'is_typing': is_typing
                }, room=f'user_{student_user.id}')
                print(f"DEBUG [OFFICE]: Emitted user_typing to user_{student_user.id}")
            else:
                print(f"DEBUG [OFFICE]: Could not find user for student {student_id}")
        
        # Student typing to office
        elif current_user.role == 'student':
            # This should be handled in student_sockets.py but kept here for completeness
            # Verify this is the student's inquiry
            inquiry = Inquiry.query.get(inquiry_id)
            if not inquiry or inquiry.student_id != current_user.student.id:
                print(f"DEBUG [OFFICE]: Student not authorized for inquiry {inquiry_id}")
                return
                
            # Send typing event to the office
            if inquiry.office_id:
                emit('student_typing', {
                    'inquiry_id': inquiry_id,
                    'student_id': current_user.id,
                    'student_name': current_user.get_full_name(),
                    'is_typing': is_typing
                }, room=f'office_{inquiry.office_id}')
                print(f"DEBUG [OFFICE]: Emitted student_typing to office_{inquiry.office_id}")
    
    @socketio.on('staff_status')
    def on_staff_status(data=None, *args):
        """Handle staff status updates (online, away, idle, etc)"""
        print(f"DEBUG [OFFICE]: staff_status received: {json.dumps(data or {})}")
        
        if not current_user.is_authenticated or current_user.role != 'office_admin':
            print(f"DEBUG [OFFICE]: Unauthorized staff_status access")
            return
            
        if data is None:
            print(f"DEBUG [OFFICE]: No data provided in staff_status event")
            return
            
        status = data.get('status')
        if not status:
            print(f"DEBUG [OFFICE]: No status in staff_status data")
            return
            
        # Broadcast to all members of this office
        office_id = current_user.office_admin.office_id if current_user.office_admin else None
        if office_id:
            emit('staff_status_update', {
                'user_id': current_user.id,
                'office_id': office_id,
                'status': status,
                'username': current_user.get_full_name(),
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f'office_{office_id}', include_self=False)
            print(f"DEBUG [OFFICE]: Broadcast status '{status}' to office_{office_id}")

def handle_inquiry_update(inquiry_id, status=None):
    """
    Emit an event when an inquiry status is updated.
    This can be called from routes to trigger real-time updates.
    
    :param inquiry_id: The ID of the inquiry that was updated
    :param status: Optional new status of the inquiry
    """
    print(f"DEBUG [OFFICE]: handle_inquiry_update called for {inquiry_id}, status: {status}")
    
    # Get the inquiry
    inquiry = Inquiry.query.get(inquiry_id)
    if not inquiry:
        print(f"DEBUG [OFFICE]: Invalid inquiry_id in handle_inquiry_update: {inquiry_id}")
        return
    
    # Get student and office details
    student = Student.query.get(inquiry.student_id)
    student_user = User.query.get(student.user_id) if student else None
    office = Office.query.get(inquiry.office_id) if inquiry.office_id else None
    
    # Default to current status if not specified
    if not status:
        status = inquiry.status

    # Create event data    
    data = {
        'inquiry_id': inquiry.id,
        'status': status,
        'title': inquiry.title,
        'description': inquiry.description,
        'student_id': inquiry.student_id,
        'office_id': inquiry.office_id,
        'office_name': office.name if office else 'Unknown Office',
        'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    }
    
    # Add student name if available
    if student_user:
        data['student_name'] = student_user.get_full_name()
    
    # Emit to the student
    if student_user:
        print(f"DEBUG [OFFICE]: Emitting inquiry_status_changed to user_{student_user.id}")
        socketio.emit('inquiry_status_changed', data, room=f'user_{student_user.id}')
        socketio.emit('inquiry_update', data, room=f'user_{student_user.id}')

    # Emit to the inquiry room
    print(f"DEBUG [OFFICE]: Emitting inquiry_status_changed to inquiry_{inquiry_id}")
    socketio.emit('inquiry_status_changed', data, room=f'inquiry_{inquiry_id}')
    
    # Emit to the office room
    if inquiry.office_id:
        print(f"DEBUG [OFFICE]: Emitting inquiry_status_changed to office_{inquiry.office_id}")
        socketio.emit('inquiry_status_changed', data, room=f'office_{inquiry.office_id}')