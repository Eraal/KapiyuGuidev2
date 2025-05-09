from flask_socketio import emit, join_room, leave_room
from flask_login import current_user
from app.models import CounselingSession, User, AuditLog
from app.extensions import socketio, db
from datetime import datetime
import json

def init_socketio():
    """Register video call socket event handlers"""
    
    @socketio.on('join_call')
    def handle_join_call(data):
        """Handle a user joining a video call room"""
        if not current_user.is_authenticated:
            return
            
        session_id = data.get('session_id')
        if not session_id:
            emit('error', {'message': 'Session ID required'})
            return
            
        # Create room name using the session ID
        room_name = f"video_session_{session_id}"
        
        # Join the room
        join_room(room_name)
        
        # Notify room that user has joined
        user_data = {
            'user_id': current_user.id,
            'name': current_user.get_full_name(),
            'role': current_user.role,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Log join event
        AuditLog.log_action(
            actor=current_user,
            action="Joined video call",
            target_type="counseling_session",
            target_id=session_id
        )
        
        emit('user_joined', user_data, room=room_name)
        
    @socketio.on('leave_call')
    def handle_leave_call(data):
        """Handle a user leaving a video call room"""
        if not current_user.is_authenticated:
            return
            
        session_id = data.get('session_id')
        if not session_id:
            return
            
        # Room name using the session ID
        room_name = f"video_session_{session_id}"
        
        # Leave the room
        leave_room(room_name)
        
        # Notify room that user has left
        emit('user_left', {
            'user_id': current_user.id,
            'name': current_user.get_full_name(),
            'timestamp': datetime.utcnow().isoformat()
        }, room=room_name)
    
    @socketio.on('video_offer')
    def handle_video_offer(data):
        """Handle SDP offer for WebRTC"""
        if not current_user.is_authenticated:
            return
            
        session_id = data.get('session_id')
        if not session_id:
            return
            
        # Room name using the session ID
        room_name = f"video_session_{session_id}"
        
        # Forward the offer to the other participant in the room
        emit('video_offer', {
            'sdp': data.get('sdp'),
            'sender_id': current_user.id,
            'sender_name': current_user.get_full_name(),
            'timestamp': datetime.utcnow().isoformat()
        }, room=room_name, include_self=False)
    
    @socketio.on('video_answer')
    def handle_video_answer(data):
        """Handle SDP answer for WebRTC"""
        if not current_user.is_authenticated:
            return
            
        session_id = data.get('session_id')
        if not session_id:
            return
            
        # Room name using the session ID
        room_name = f"video_session_{session_id}"
        
        # Forward the answer to the other participant
        emit('video_answer', {
            'sdp': data.get('sdp'),
            'sender_id': current_user.id,
            'sender_name': current_user.get_full_name(),
            'timestamp': datetime.utcnow().isoformat()
        }, room=room_name, include_self=False)
    
    @socketio.on('ice_candidate')
    def handle_ice_candidate(data):
        """Handle ICE candidate for WebRTC"""
        if not current_user.is_authenticated:
            return
            
        session_id = data.get('session_id')
        if not session_id:
            return
            
        # Room name using the session ID
        room_name = f"video_session_{session_id}"
        
        # Forward the ICE candidate to the other participant
        emit('ice_candidate', {
            'candidate': data.get('candidate'),
            'sender_id': current_user.id,
            'timestamp': datetime.utcnow().isoformat()
        }, room=room_name, include_self=False)
    
    @socketio.on('call_status')
    def handle_call_status(data):
        """Handle call status updates"""
        if not current_user.is_authenticated:
            return
            
        session_id = data.get('session_id')
        if not session_id:
            return
            
        # Room name using the session ID
        room_name = f"video_session_{session_id}"
        
        # Forward the status update
        emit('call_status', {
            'status': data.get('status'),
            'sender_id': current_user.id,
            'timestamp': datetime.utcnow().isoformat(),
            'details': data.get('details', {})
        }, room=room_name)