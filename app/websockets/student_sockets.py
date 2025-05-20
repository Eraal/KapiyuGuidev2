from app.extensions import socketio
from flask_login import current_user
from flask_socketio import emit, join_room, leave_room
from datetime import datetime
import json
from app.models import Inquiry, InquiryMessage, User, Student, Office, OfficeAdmin
from app import db

def init_socketio():
    """Register student socket event handlers"""
    
    @socketio.on('join')
    def on_join(data):
        """Handle join room events for students"""
        print(f"DEBUG: Student join room event: {json.dumps(data)}")
        if not current_user.is_authenticated or current_user.role != 'student':
            print(f"DEBUG: Unauthorized join attempt: {current_user.id if current_user.is_authenticated else 'Not authenticated'}")
            return
            
        # Join personal room for this student
        room = data.get('room')
        if room:
            join_room(room)
            print(f"DEBUG: Student {current_user.id} joined room: {room}")
            emit('status', {'msg': f'Joined room: {room}'}, room=room)
    
    @socketio.on('connect')
    def on_connect():
        """Handle connection events for students"""
        print(f"DEBUG: Student socket connection: {current_user.id if current_user.is_authenticated else 'Not authenticated'}")
        if current_user.is_authenticated and current_user.role == 'student':
            # Join student's personal room based on user ID
            user_room = f'user_{current_user.id}'
            join_room(user_room)
            
            # Also join the student-specific room for legacy support
            student_room = f'student_{current_user.id}'
            join_room(student_room)
            
            # Also join the general student room
            join_room('student_room')
            
            print(f"DEBUG: Student {current_user.get_full_name()} joined rooms: user_{current_user.id}, student_{current_user.id}, student_room")
            emit('status', {'msg': 'Connected to student socket'}, room=user_room)
    
    @socketio.on('disconnect')
    def on_disconnect():
        """Handle disconnect events"""
        print(f"DEBUG: Student socket disconnected: {current_user.id if current_user.is_authenticated else 'Not authenticated'}")
    
    @socketio.on('new_chat_message')
    def on_new_chat_message(data):
        """Handle new chat messages from office admins"""
        print(f"DEBUG: on_new_chat_message received: {json.dumps(data)}")
        
        if not current_user.is_authenticated or current_user.role != 'student':
            print(f"DEBUG: Unauthorized access to new_chat_message: {current_user.id if current_user.is_authenticated else 'Not authenticated'}")
            return
        
        inquiry_id = data.get('inquiry_id')
        if not inquiry_id:
            print(f"DEBUG: No inquiry_id in new_chat_message data")
            return
            
        # Verify that this student should receive this message
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry or inquiry.student_id != current_user.student.id:
            print(f"DEBUG: Student {current_user.id} not authorized for inquiry {inquiry_id}")
            return
        
        # Just emit to the user's personal room as confirmation of receipt
        emit('message_received', {
            'inquiry_id': inquiry_id,
            'message_id': data.get('message_id'),
            'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        }, room=f'user_{current_user.id}')
        
        print(f"DEBUG: Message receipt confirmed to user_{current_user.id}")
        
        # Re-emit the message to ensure it gets processed by the client
        emit('new_chat_message', data, room=f'user_{current_user.id}')
        print(f"DEBUG: Re-emitted message to user_{current_user.id}")

    @socketio.on('chat_message_sent')
    def on_chat_message_sent(data):
        """Handle when a student sends a new chat message"""
        print(f"DEBUG: on_chat_message_sent received: {json.dumps(data)}")
        
        if not current_user.is_authenticated or current_user.role != 'student':
            print(f"DEBUG: Unauthorized chat_message_sent access: {current_user.id if current_user.is_authenticated else 'Not authenticated'}")
            return
            
        inquiry_id = data.get('inquiry_id')
        message_id = data.get('message_id')
        content = data.get('content')
        office_id = data.get('office_id')
        
        print(f"DEBUG: Student {current_user.id} sending message for inquiry {inquiry_id} to office {office_id}")
        
        # Validate the inquiry belongs to this student
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry or inquiry.student_id != current_user.student.id:
            print(f"DEBUG: Student {current_user.id} not authorized for inquiry {inquiry_id}")
            return
        
        # If message_id isn't provided, this could be a real-time notification before DB save
        # In this case, create a temporary ID
        if not message_id:
            from uuid import uuid4
            message_id = f'temp_{str(uuid4())}'
            print(f"DEBUG: Created temporary message_id: {message_id}")
        
        # Save to database if we have content
        if content:
            try:
                new_message = InquiryMessage(
                    inquiry_id=inquiry_id,
                    sender_id=current_user.id,
                    content=content
                )
                db.session.add(new_message)
                db.session.commit()
                message_id = new_message.id
                print(f"DEBUG: Saved message to database with ID: {message_id}")
            except Exception as e:
                print(f"DEBUG: Error saving message to database: {str(e)}")
                db.session.rollback()
        
        # Emit to office admins that a new message was sent
        if inquiry_id and office_id:
            # First check if office_id is valid
            office = Office.query.get(office_id)
            if not office:
                print(f"DEBUG: Invalid office_id: {office_id}")
                return
                
            # Ensure we use the right office_id from the inquiry
            if not inquiry.office_id:
                inquiry.office_id = office_id
                db.session.commit()
                print(f"DEBUG: Updated inquiry {inquiry_id} with office_id {office_id}")
            
            # Create the message payload
            message_data = {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'sender_id': current_user.id,
                'sender_name': current_user.get_full_name(),
                'content': content,
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                'is_student': True,
                'student_id': current_user.student.id,
                'office_id': office_id
            }
            
            # Try multiple event types to ensure delivery
            # 1. Specific event for office admins
            emit('student_message_sent', message_data, room=f'office_{office_id}')
            print(f"DEBUG: Emitted student_message_sent to office_{office_id}: {json.dumps(message_data)}")
            
            # 2. General message event that many handlers listen for
            emit('new_chat_message', message_data, room=f'office_{office_id}')
            print(f"DEBUG: Emitted new_chat_message to office_{office_id}")
            
            # 3. Try the inquiry-specific room too
            emit('new_chat_message', message_data, room=f'inquiry_{inquiry_id}')
            print(f"DEBUG: Emitted to inquiry_{inquiry_id} room")
            
            # 4. Try for any admin viewing this specific inquiry
            emit('new_message', message_data, room=f'inquiry_view_{inquiry_id}')
            print(f"DEBUG: Emitted to inquiry_view_{inquiry_id} room")
            
            # Also emit a sent confirmation back to the sender
            emit('message_status_update', {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'status': 'sent',
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f'user_{current_user.id}')
            
            print(f"DEBUG: Sent confirmation back to student user_{current_user.id}")
            
            # Also update the student's UI with their own message
            emit('new_chat_message', {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'sender_id': current_user.id,
                'sender_name': current_user.get_full_name(),
                'content': content,
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                'is_student': True,
                'status': 'sent'
            }, room=f'user_{current_user.id}')
            
            print(f"DEBUG: Sent student's own message back to their UI")
    
    @socketio.on('chat_message_delivered')
    def on_chat_message_delivered(data):
        """Handle when a chat message is delivered to recipient"""
        print(f"DEBUG: on_chat_message_delivered received: {json.dumps(data)}")
        
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
                print(f"DEBUG: Updated message {message_id} status to 'delivered' in database")
            
            # Emit to sender that message was delivered
            emit('message_status_update', {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'status': 'delivered',
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f'user_{sender_id}')
            
            print(f"DEBUG: Emitted message_status_update (delivered) to user_{sender_id}")
    
    @socketio.on('chat_message_read')
    def on_chat_message_read(data):
        """Handle when a chat message is read by recipient"""
        print(f"DEBUG: on_chat_message_read received: {json.dumps(data)}")
        
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
                print(f"DEBUG: Updated message {message_id} status to 'read' in database")
            
            # Emit to sender that message was read
            emit('message_status_update', {
                'inquiry_id': inquiry_id,
                'message_id': message_id,
                'status': 'read',
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f'user_{sender_id}')
            
            print(f"DEBUG: Emitted message_status_update (read) to user_{sender_id}")
    
    @socketio.on('student_typing')
    def on_student_typing(data):
        """Handle student typing indicators"""
        print(f"DEBUG: on_student_typing received: {json.dumps(data)}")
        
        if not current_user.is_authenticated or current_user.role != 'student':
            print(f"DEBUG: Unauthorized student_typing access")
            return
            
        inquiry_id = data.get('inquiry_id')
        is_typing = data.get('is_typing', False)
        office_admin_id = data.get('office_admin_id')
        
        if not inquiry_id:
            print(f"DEBUG: No inquiry_id in typing data")
            return
            
        # Get the inquiry to verify it belongs to this student
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry or inquiry.student_id != current_user.student.id:
            print(f"DEBUG: Student not authorized for inquiry {inquiry_id}")
            return
            
        # Forward typing indicator to the office
        if inquiry.office_id:
            emit('student_typing', {
                'inquiry_id': inquiry_id,
                'student_id': current_user.id,
                'student_name': current_user.get_full_name(),
                'is_typing': is_typing
            }, room=f'office_{inquiry.office_id}')
            print(f"DEBUG: Emitted student_typing to office_{inquiry.office_id}")
            
            # Also emit to the inquiry room
            emit('student_typing', {
                'inquiry_id': inquiry_id,
                'student_id': current_user.id,
                'student_name': current_user.get_full_name(),
                'is_typing': is_typing
            }, room=f'inquiry_{inquiry_id}')
            print(f"DEBUG: Emitted student_typing to inquiry_{inquiry_id}")
    
    @socketio.on('typing_indicator')
    def on_typing_indicator(data):
        """Broadcast typing indicator to the other party in a chat"""
        print(f"DEBUG: on_typing_indicator received: {json.dumps(data)}")
        
        if not current_user.is_authenticated:
            return
        
        inquiry_id = data.get('inquiry_id')
        is_typing = data.get('is_typing', False)
        
        if not inquiry_id:
            print(f"DEBUG: No inquiry_id in typing indicator data")
            return
        
        # Get the inquiry to find the relevant office
        inquiry = Inquiry.query.get(inquiry_id)
        if not inquiry:
            print(f"DEBUG: Invalid inquiry_id: {inquiry_id}")
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
            print(f"DEBUG: Emitted user_typing to {room}")
        
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
                print(f"DEBUG: Emitted user_typing to {room}")
                
                # Also emit admin-specific typing event
                emit('admin_typing', {
                    'inquiry_id': inquiry_id,
                    'office_admin_id': current_user.id,
                    'admin_name': current_user.get_full_name(),
                    'is_typing': is_typing
                }, room=room)
                print(f"DEBUG: Emitted admin_typing to {room}")

def emit_inquiry_reply(message):
    """
    Emit event when a new message is added to an inquiry.
    This can be called from routes to trigger real-time updates.
    
    :param message: The InquiryMessage object that was just created
    """
    if not message:
        print(f"DEBUG: emit_inquiry_reply called with invalid message")
        return
    
    # Get the inquiry
    inquiry = Inquiry.query.get(message.inquiry_id)
    if not inquiry:
        print(f"DEBUG: Invalid inquiry_id in emit_inquiry_reply: {message.inquiry_id}")
        return
    
    # Get sender details
    sender = User.query.get(message.sender_id)
    if not sender:
        print(f"DEBUG: Invalid sender_id in emit_inquiry_reply: {message.sender_id}")
        return
    
    print(f"DEBUG: emit_inquiry_reply processing message {message.id} from {sender.role}")
    
    # Determine target room based on sender role
    if sender.role == 'student':
        # Message from student to office
        message_data = {
            'inquiry_id': inquiry.id,
            'message_id': message.id,
            'sender_id': sender.id,
            'sender_name': sender.get_full_name(),
            'content': message.content,
            'timestamp': message.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'status': 'sent',
            'is_student': True
        }
        
        # Emit all event types that office might be listening for
        socketio.emit('new_chat_message', message_data, room=f'office_{inquiry.office_id}')
        socketio.emit('student_message_sent', message_data, room=f'office_{inquiry.office_id}')
        socketio.emit('new_message', message_data, room=f'office_{inquiry.office_id}')
        
        print(f"DEBUG: Emitted student message to office_{inquiry.office_id}")
        
        # Also emit to the inquiry-specific room for other admins viewing the same inquiry
        socketio.emit('new_chat_message', message_data, room=f'inquiry_{inquiry.id}')
        print(f"DEBUG: Emitted student message to inquiry_{inquiry.id}")
    else:
        # Message from office to student
        # Get student
        student = Student.query.get(inquiry.student_id)
        if student:
            student_user = User.query.get(student.user_id)
            if student_user:
                # Get office name
                office_name = "Office"
                if sender.office_admin:
                    office = Office.query.get(sender.office_admin.office_id)
                    if office:
                        office_name = office.name
                
                message_data = {
                    'inquiry_id': inquiry.id,
                    'message_id': message.id,
                    'sender_id': sender.id,
                    'sender_name': sender.get_full_name(),
                    'content': message.content,
                    'timestamp': message.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    'status': 'sent',
                    'office_name': office_name,
                    'from_admin': True
                }
                
                # Emit all event types student might be listening for
                socketio.emit('new_chat_message', message_data, room=f'user_{student_user.id}')
                socketio.emit('new_message', message_data, room=f'user_{student_user.id}')
                
                print(f"DEBUG: Emitted admin message to student user_{student_user.id}")