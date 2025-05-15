from flask_socketio import emit, join_room, leave_room
from flask import request
from flask_login import current_user
from app.models import CounselingSession, User, AuditLog, SessionParticipation
from app.extensions import socketio, db
from datetime import datetime
import json

def init_socketio():
    """Register video call socket event handlers"""
    
    @socketio.on('connect')
    def handle_connect():
        if not current_user.is_authenticated:
            return False  # Reject the connection if user is not authenticated
        
        # User is authenticated, allow connection
        print(f"SocketIO: User {current_user.id} connected")
    
    @socketio.on('join_call')
    def handle_join_call(data):
        """Handle user joining a video call room"""
        if not current_user.is_authenticated:
            return
        
        session_id = data.get('session_id')
        if not session_id:
            return
        
        # Fetch session details
        counseling_session = CounselingSession.query.filter_by(
            id=session_id
        ).first()
        
        if not counseling_session:
            emit('error', {'message': 'Invalid session'})
            return
            
        # Join the room
        room = f"video_call_{session_id}"
        join_room(room)
        
        # Update waiting room status
        user_role = current_user.role
        
        if user_role == 'office_admin':
            # Office admin entering waiting room
            counseling_session.counselor_in_waiting_room = True
            # Log the activity
            AuditLog.log_action(
                actor=current_user,
                action="Entered video session waiting room",
                target_type="counseling_session",
                status=counseling_session.status,
                is_success=True
            )
        elif user_role == 'student':
            # Student entering waiting room
            counseling_session.student_in_waiting_room = True
            # Log the activity
            student = current_user.student
            if student:
                from app.models import StudentActivityLog
                StudentActivityLog.log_action(
                    student=student,
                    action="Entered video session waiting room",
                    related_id=counseling_session.id,
                    related_type="counseling_session"
                )
        
        db.session.commit()
        
        # Get waiting room status
        waiting_status = counseling_session.get_waiting_room_status()
        
        # Notify other participants
        emit('user_joined', {
            'user_id': current_user.id,
            'name': current_user.get_full_name(),
            'role': current_user.role,
            'waiting_status': waiting_status
        }, room=room)
        
        # If both participants are in the waiting room, automatically start the call
        if waiting_status == "both_waiting" and not counseling_session.call_started_at:
            counseling_session.call_started_at = datetime.utcnow()
            db.session.commit()
            emit('start_call', {
                'message': 'Both participants are ready. Starting the call.',
                'session_id': session_id
            }, room=room)
    
    @socketio.on('leave_call')
    def handle_leave_call(data):
        """Handle user leaving a video call room"""
        if not current_user.is_authenticated:
            return
            
        session_id = data.get('session_id')
        if not session_id:
            return
            
        # Leave the room
        room = f"video_call_{session_id}"
        leave_room(room)
        
        # Update waiting room status
        counseling_session = CounselingSession.query.filter_by(
            id=session_id
        ).first()
        
        if counseling_session:
            user_role = current_user.role
            
            if user_role == 'office_admin':
                # Office admin leaving waiting room
                counseling_session.counselor_in_waiting_room = False
                
                # Update participation record
                participation = SessionParticipation.query.filter_by(
                    session_id=session_id,
                    user_id=current_user.id,
                    left_at=None
                ).order_by(SessionParticipation.joined_at.desc()).first()
                
                if participation:
                    participation.left_at = datetime.utcnow()
                    db.session.commit()
                
            elif user_role == 'student':
                # Student leaving waiting room
                counseling_session.student_in_waiting_room = False
                
                # Update participation record
                participation = SessionParticipation.query.filter_by(
                    session_id=session_id,
                    user_id=current_user.id,
                    left_at=None
                ).order_by(SessionParticipation.joined_at.desc()).first()
                
                if participation:
                    participation.left_at = datetime.utcnow()
                    db.session.commit()
            
            # If either participant leaves, the call is no longer in progress
            counseling_session.call_started_at = None
            db.session.commit()
        
        # Notify others that user left
        emit('user_left', {
            'user_id': current_user.id,
            'name': current_user.get_full_name()
        }, room=room)
    
    @socketio.on('video_offer')
    def handle_video_offer(data):
        """Forward video offer to peer"""
        session_id = data.get('session_id')
        sdp = data.get('sdp')
        
        if not session_id or not sdp:
            return
            
        room = f"video_call_{session_id}"
        
        # Send offer to other participant in the room
        emit('video_offer', {
            'sdp': sdp,
            'sender_id': current_user.id,
            'sender_name': current_user.get_full_name()
        }, room=room, skip_sid=request.sid)
    
    @socketio.on('video_answer')
    def handle_video_answer(data):
        """Forward video answer to peer"""
        session_id = data.get('session_id')
        sdp = data.get('sdp')
        
        if not session_id or not sdp:
            return
            
        room = f"video_call_{session_id}"
        
        # Send answer to other participant in the room
        emit('video_answer', {
            'sdp': sdp,
            'sender_id': current_user.id,
            'sender_name': current_user.get_full_name()
        }, room=room, skip_sid=request.sid)
    
    @socketio.on('ice_candidate')
    def handle_ice_candidate(data):
        """Forward ICE candidates to peer"""
        session_id = data.get('session_id')
        candidate = data.get('candidate')
        
        if not session_id or not candidate:
            return
            
        room = f"video_call_{session_id}"
        
        # Send ICE candidate to other participant in the room
        emit('ice_candidate', {
            'candidate': candidate,
            'sender_id': current_user.id
        }, room=room, skip_sid=request.sid)
    
    @socketio.on('waiting_room_message')
    def handle_waiting_room_message(data):
        """Send a message from one participant to another in the waiting room"""
        session_id = data.get('session_id')
        message = data.get('message')
        
        if not session_id or not message:
            return
            
        room = f"video_call_{session_id}"
        
        # Send message to the other participant
        emit('waiting_room_message', {
            'message': message,
            'sender_id': current_user.id,
            'sender_name': current_user.get_full_name(),
            'sender_role': current_user.role,
            'timestamp': datetime.utcnow().isoformat()
        }, room=room)
    
    @socketio.on('check_waiting_room_status')
    def handle_check_waiting_room_status(data):
        """Check and broadcast the current waiting room status"""
        session_id = data.get('session_id')
        
        if not session_id:
            return
            
        # Fetch session details
        counseling_session = CounselingSession.query.filter_by(
            id=session_id
        ).first()
        
        if not counseling_session:
            emit('error', {'message': 'Invalid session'})
            return
        
        room = f"video_call_{session_id}"
        waiting_status = counseling_session.get_waiting_room_status()
        
        # Send status to the room
        emit('waiting_room_status', {
            'status': waiting_status,
            'counselor_waiting': counseling_session.counselor_in_waiting_room,
            'student_waiting': counseling_session.student_in_waiting_room,
            'call_started': counseling_session.call_started_at is not None
        }, room=room)