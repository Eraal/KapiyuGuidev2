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
from app.models import InquiryMessage, User
from app.utils import format_date

def init_socketio():
    """Register chat socket event handlers"""
    # All the socket event handlers are already registered using decorators
    # This function exists to match the pattern used in other socket modules
    current_app.logger.info("Chat socketio handlers initialized")

@socketio.on('join')
def on_join(data):
    """Handle a client joining a room"""
    if not current_user.is_authenticated:
        return
        
    room = data.get('room')
    if not room:
        return
        
    join_room(room)
    current_app.logger.info(f"User {current_user.id} joined room: {room}")

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
        
    message_data = {
        'message_id': message.id,
        'inquiry_id': message.inquiry_id,
        'content': message.content,
        'timestamp': format_date(message.created_at),
        'sender_id': message.sender_id,
        'sender_name': sender.full_name,
        'sender_role': sender.role,
        'status': message.status
    }
    
    # Broadcast to the room
    room = f'inquiry_{inquiry_id}'
    emit('new_message', message_data, room=room)
    
    current_app.logger.info(f"New message notification: {message_id} in room {room}")

@socketio.on('typing_indicator')
def handle_typing_indicator(data):
    """Handle typing indicator events"""
    if not current_user.is_authenticated:
        return
        
    # Get the inquiry ID and typing status
    inquiry_id = data.get('inquiry_id')
    is_typing = data.get('is_typing', False)
    
    if not inquiry_id:
        return
        
    # Prepare data to emit
    typing_data = {
        'inquiry_id': inquiry_id,
        'user_id': current_user.id,
        'user_name': current_user.full_name,
        'is_typing': is_typing
    }
    
    # Broadcast to the room
    room = f'inquiry_{inquiry_id}'
    emit('user_typing', typing_data, room=room, include_self=False)
    
    current_app.logger.debug(f"Typing indicator: User {current_user.id} is {'typing' if is_typing else 'stopped typing'} in inquiry {inquiry_id}")

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
        
        current_app.logger.debug(f"Message {message_id} marked as read by user {current_user.id}")
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error marking message as read: {str(e)}")