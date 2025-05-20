"""
Chat WebSocket Handlers for the KapiyuGuide System

This module handles WebSocket events for real-time chat functionality,
including message delivery, typing indicators, and message status updates.
"""

from flask_socketio import emit, join_room, leave_room
from flask import request, current_app
from flask_login import current_user
import json
import datetime
from app.extensions import db, socketio
from app.models import InquiryMessage, User, Office
from app.utils import format_date

def init_socketio():
    """Register chat socket event handlers"""
    # All the socket event handlers are already registered using decorators
    # This function exists to match the pattern used in other socket modules
    current_app.logger.info("Chat socketio handlers initialized")

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    if current_user.is_authenticated:
        current_app.logger.debug(f"User {current_user.id} connected to websocket")
    else:
        current_app.logger.debug("Unauthenticated user connected to websocket")

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    if current_user.is_authenticated:
        current_app.logger.debug(f"User {current_user.id} disconnected from websocket")
    else:
        current_app.logger.debug("Unauthenticated user disconnected from websocket")

@socketio.on('join')
def on_join(data=None):
    """Handle a client joining a room"""
    if not current_user.is_authenticated or not data:
        return
        
    room = data.get('room')
    if not room:
        return
        
    join_room(room)
    current_app.logger.info(f"User {current_user.id} joined room: {room}")

    # Emit an acknowledgement back to the client
    emit('room_joined', {
        'room': room,
        'user_id': current_user.id,
        'role': current_user.role,
        'status': 'success'
    })

@socketio.on('leave')
def on_leave(data):
    """Handle a client leaving a room"""
    if not current_user.is_authenticated:
        return
        
    room = data.get('room')
    if not room:
        return
        
    leave_room(room)
    current_app.logger.info(f"User {current_user.id} left room: {room}")

@socketio.on('join_inquiry_room')
def on_join_inquiry(data):
    """Handle joining a specific inquiry room"""
    if not current_user.is_authenticated:
        return
        
    inquiry_id = data.get('inquiry_id')
    if not inquiry_id:
        return
        
    room = f'inquiry_{inquiry_id}'
    join_room(room)
    current_app.logger.info(f"User {current_user.id} joined inquiry room: {room}")
    
    # Send acknowledgement to client
    emit('room_joined', {
        'room': room,
        'inquiry_id': inquiry_id,
        'user_id': current_user.id,
        'status': 'success'
    })

@socketio.on('new_message_notification')
def handle_new_message(data):
    """
    Handle a new message notification after it's been saved to the database.
    This is called after a regular HTTP post to send a message.
    """
    if not current_user.is_authenticated:
        return
        
    # Get required data
    inquiry_id = data.get('inquiry_id')
    message_id = data.get('message_id')
    
    if not inquiry_id or not message_id:
        return
        
    # Fetch the message from the database
    message = InquiryMessage.query.get(message_id)
    if not message or message.inquiry_id != int(inquiry_id):
        return
        
    # Prepare data to emit
    sender = User.query.get(message.sender_id)
    if not sender:
        return
    
    # Get additional data for office users
    office_id = None
    office_name = None
    if sender.role == 'office_admin' and hasattr(sender, 'office_id'):
        office_id = sender.office_id
        office = Office.query.get(office_id)
        if office:
            office_name = office.name
        
    message_data = {
        'message_id': message.id,
        'inquiry_id': message.inquiry_id,
        'content': message.content,
        'timestamp': format_date(message.created_at),
        'sender_id': message.sender_id,
        'sender_name': sender.full_name,
        'sender_role': sender.role,
        'status': message.status,
        'from_admin': sender.role == 'office_admin',
        'office_id': office_id,
        'office_name': office_name,
        'student_id': message.inquiry.student_id if hasattr(message.inquiry, 'student_id') else None
    }
    
    # Broadcast to the room
    room = f'inquiry_{inquiry_id}'
    emit('new_message', message_data, room=room)
    
    # Also emit to personal rooms for offline notifications
    if sender.role == 'office_admin' and message.inquiry.student_id:
        # Send to student's personal room
        student_room = f'user_{message.inquiry.student_id}'
        emit('new_chat_message', message_data, room=student_room)
        current_app.logger.info(f"New message notification sent to student room: {student_room}")
    elif sender.role == 'student' and message.inquiry.office_id:
        # Send to office's room
        office_room = f'office_{message.inquiry.office_id}'
        emit('new_chat_message', message_data, room=office_room)
        current_app.logger.info(f"New message notification sent to office room: {office_room}")
    
    current_app.logger.info(f"New message notification: {message_id} in room {room}")

@socketio.on('chat_message_sent')
def handle_chat_message_sent(data):
    """Handle direct socket message sent (may be used instead of HTTP POST)"""
    if not current_user.is_authenticated:
        return
        
    inquiry_id = data.get('inquiry_id')
    content = data.get('content')
    
    if not inquiry_id or not content:
        emit('error', {'message': 'Missing required data'})
        return
    
    try:
        # Create a new message
        new_message = InquiryMessage(
            inquiry_id=inquiry_id,
            sender_id=current_user.id,
            content=content,
            status='sent'
        )
        
        db.session.add(new_message)
        db.session.commit()
        
        # Get additional data
        office_id = None
        office_name = None
        if current_user.role == 'office_admin' and hasattr(current_user, 'office_id'):
            office_id = current_user.office_id
            office = Office.query.get(office_id)
            if office:
                office_name = office.name
        
        # Prepare message data
        message_data = {
            'message_id': new_message.id,
            'inquiry_id': new_message.inquiry_id,
            'content': new_message.content,
            'timestamp': format_date(new_message.created_at),
            'sender_id': new_message.sender_id,
            'sender_name': current_user.full_name,
            'sender_role': current_user.role,
            'status': 'sent',
            'from_admin': current_user.role == 'office_admin',
            'office_id': office_id,
            'office_name': office_name,
            'student_id': new_message.inquiry.student_id if hasattr(new_message.inquiry, 'student_id') else None
        }
        
        # Broadcast to the inquiry room
        room = f'inquiry_{inquiry_id}'
        emit('new_message', message_data, room=room)
        
        # Also emit to personal rooms
        if current_user.role == 'office_admin' and new_message.inquiry.student_id:
            # Send to student's personal room
            student_room = f'user_{new_message.inquiry.student_id}'
            emit('new_chat_message', message_data, room=student_room)
        elif current_user.role == 'student' and new_message.inquiry.office_id:
            # Send to office's room
            office_room = f'office_{new_message.inquiry.office_id}'
            emit('new_chat_message', message_data, room=office_room)
        
        # Acknowledge receipt to sender
        emit('message_sent', {'message_id': new_message.id, 'status': 'success'})
        
        current_app.logger.info(f"Message {new_message.id} sent via websocket to room {room}")
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error sending message via websocket: {str(e)}")
        emit('error', {'message': 'Error sending message'})

@socketio.on('typing_indicator')
def handle_typing_indicator(data):
    """Handle typing indicator events"""
    if not current_user.is_authenticated:
        return
    
    inquiry_id = data.get('inquiry_id')
    is_typing = data.get('is_typing', False)
    
    if not inquiry_id:
        return
    
    # Prepare typing data
    typing_data = {
        'inquiry_id': inquiry_id,
        'user_id': current_user.id,
        'user_name': current_user.full_name,
        'is_typing': is_typing
    }
    
    room = f'inquiry_{inquiry_id}'
    emit('typing_indicator', typing_data, room=room, include_self=False)
    current_app.logger.debug(f"Typing indicator sent: User {current_user.id} is {'typing' if is_typing else 'not typing'} in inquiry {inquiry_id}")

@socketio.on('student_typing')
def handle_student_typing(data):
    """Handle student typing indicator events"""
    if not current_user.is_authenticated or current_user.role != 'student':
        return
    
    inquiry_id = data.get('inquiry_id')
    office_admin_id = data.get('office_admin_id')
    is_typing = data.get('is_typing', False)
    
    if not inquiry_id:
        return
    
    # Prepare typing data
    typing_data = {
        'inquiry_id': inquiry_id,
        'student_id': current_user.id,
        'student_name': current_user.full_name,
        'office_admin_id': office_admin_id,
        'is_typing': is_typing
    }
    
    # Send to the inquiry room
    room = f'inquiry_{inquiry_id}'
    emit('student_typing', typing_data, room=room, include_self=False)
    
    # Also send to specific office admin if specified
    if office_admin_id:
        admin_room = f'user_{office_admin_id}'
        emit('student_typing', typing_data, room=admin_room)
    
    current_app.logger.debug(f"Student typing indicator: {current_user.id} is {'typing' if is_typing else 'not typing'} in inquiry {inquiry_id}")

@socketio.on('admin_typing')
def handle_admin_typing(data):
    """Handle admin typing indicator events"""
    if not current_user.is_authenticated or current_user.role != 'office_admin':
        return
    
    inquiry_id = data.get('inquiry_id')
    student_id = data.get('student_id')
    is_typing = data.get('is_typing', False)
    
    if not inquiry_id or not student_id:
        return
    
    # Prepare typing data
    typing_data = {
        'inquiry_id': inquiry_id,
        'office_admin_id': current_user.id,
        'admin_name': current_user.full_name,
        'student_id': student_id,
        'is_typing': is_typing
    }
    
    # Send to the inquiry room
    room = f'inquiry_{inquiry_id}'
    emit('admin_typing', typing_data, room=room, include_self=False)
    
    # Also send to the student's room
    student_room = f'user_{student_id}'
    emit('admin_typing', typing_data, room=student_room)
    
    current_app.logger.debug(f"Admin typing indicator: {current_user.id} is {'typing' if is_typing else 'not typing'} to student {student_id}")

@socketio.on('chat_message_delivered')
def handle_message_delivered(data):
    """Handle message delivered events"""
    if not current_user.is_authenticated:
        return
        
    # Get required data
    inquiry_id = data.get('inquiry_id')
    message_id = data.get('message_id')
    sender_id = data.get('sender_id')
    
    if not inquiry_id or not message_id or not sender_id:
        return
        
    # Update status in the database
    message = InquiryMessage.query.get(message_id)
    if not message or str(message.inquiry_id) != str(inquiry_id) or str(message.sender_id) != str(sender_id):
        return
    
    # Update the message status directly
    message.status = 'delivered'
    message.delivered_at = datetime.datetime.utcnow()
        
    try:
        db.session.commit()
        
        # Broadcast status update to the room
        room = f'inquiry_{inquiry_id}'
        emit('message_status_update', {
            'inquiry_id': inquiry_id,
            'message_id': message_id,
            'status': 'delivered',
            'user_id': current_user.id
        }, room=room)
        
        # Also send to sender's personal room
        sender_room = f'user_{sender_id}'
        emit('message_status_update', {
            'inquiry_id': inquiry_id,
            'message_id': message_id,
            'status': 'delivered',
            'user_id': current_user.id
        }, room=sender_room)
        
        current_app.logger.debug(f"Message {message_id} marked as delivered by user {current_user.id}")
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error marking message as delivered: {str(e)}")

@socketio.on('chat_message_read')
def handle_message_read(data):
    """Handle message read events"""
    if not current_user.is_authenticated:
        return
        
    # Get required data
    inquiry_id = data.get('inquiry_id')
    message_id = data.get('message_id')
    sender_id = data.get('sender_id')
    
    if not inquiry_id or not message_id or not sender_id:
        return
        
    # Update status in the database
    message = InquiryMessage.query.get(message_id)
    if not message or str(message.inquiry_id) != str(inquiry_id) or str(message.sender_id) != str(sender_id):
        return
    
    # Update the message status directly
    message.status = 'read'
    message.read_at = datetime.datetime.utcnow()
        
    try:
        db.session.commit()
        
        # Broadcast status update to the room
        room = f'inquiry_{inquiry_id}'
        emit('message_status_update', {
            'inquiry_id': inquiry_id,
            'message_id': message_id,
            'status': 'read',
            'user_id': current_user.id
        }, room=room)
        
        # Also send to sender's personal room
        sender_room = f'user_{sender_id}'
        emit('message_status_update', {
            'inquiry_id': inquiry_id,
            'message_id': message_id,
            'status': 'read',
            'user_id': current_user.id
        }, room=sender_room)
        
        current_app.logger.debug(f"Message {message_id} marked as read by user {current_user.id}")
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error marking message as read: {str(e)}")

@socketio.on('message_received')
def handle_message_received(data):
    """Handle message received confirmation (for logging/debugging)"""
    if not current_user.is_authenticated:
        return
    
    inquiry_id = data.get('inquiry_id')
    message_id = data.get('message_id')
    
    if not inquiry_id or not message_id:
        return
    
    current_app.logger.debug(f"Message {message_id} received confirmation from user {current_user.id}")