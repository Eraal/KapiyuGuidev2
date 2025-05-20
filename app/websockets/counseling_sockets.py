from flask_socketio import emit, join_room, leave_room
from flask import request
from flask_login import current_user
from app.models import CounselingSession, User, AuditLog, SessionParticipation, OfficeAdmin, Student
from app.extensions import socketio, db
from datetime import datetime
import json

def init_socketio():
    """Register counseling session socket event handlers"""
    
    @socketio.on('connect', namespace='/counseling')
    def handle_connect():
        """Handle client connection for counseling sessions"""
        if not current_user.is_authenticated:
            return False  # Reject the connection if user is not authenticated
        
        # User is authenticated, allow connection
        print(f"Counseling SocketIO: User {current_user.id} connected")
    
    @socketio.on('disconnect', namespace='/counseling')
    def handle_disconnect():
        """Handle client disconnection for counseling sessions"""
        if not current_user.is_authenticated:
            return
            
        print(f"Counseling SocketIO: User {current_user.id} disconnected")
    
    @socketio.on('join_counseling_room', namespace='/counseling')
    def handle_join_counseling_room(data):
        """Handle user joining a counseling session room"""
        if not current_user.is_authenticated:
            return
            
        session_id = data.get('session_id')
        if not session_id:
            return
            
        # Join the counseling session room
        room = f"counseling_{session_id}"
        join_room(room)
        
        print(f"User {current_user.id} joined counseling room: {room}")
        
        # Notify room of join
        emit('user_joined_counseling', {
            'user_id': current_user.id,
            'name': current_user.get_full_name(),
            'role': current_user.role,
            'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        }, room=room)
    
    @socketio.on('leave_counseling_room', namespace='/counseling')
    def handle_leave_counseling_room(data):
        """Handle user leaving a counseling session room"""
        if not current_user.is_authenticated:
            return
            
        session_id = data.get('session_id')
        if not session_id:
            return
            
        # Leave the counseling session room
        room = f"counseling_{session_id}"
        leave_room(room)
        
        print(f"User {current_user.id} left counseling room: {room}")
        
        # Notify room of leave
        emit('user_left_counseling', {
            'user_id': current_user.id,
            'name': current_user.get_full_name(),
            'role': current_user.role,
            'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        }, room=room)
    
    @socketio.on('counseling_status_update', namespace='/counseling')
    def handle_counseling_status_update(data):
        """Handle counseling session status updates"""
        if not current_user.is_authenticated:
            return
            
        session_id = data.get('session_id')
        status = data.get('status')
        
        if not session_id or not status:
            return
            
        # Update status in database
        counseling_session = CounselingSession.query.get(session_id)
        if not counseling_session:
            emit('error', {'message': 'Invalid session'})
            return
            
        # Verify user has permission to update status
        if current_user.role == 'office_admin':
            # Check if admin belongs to the session's office
            office_admin = OfficeAdmin.query.filter_by(user_id=current_user.id).first()
            if not office_admin or office_admin.office_id != counseling_session.office_id:
                emit('error', {'message': 'Unauthorized'})
                return
        elif current_user.role == 'student':
            # Check if student is part of this session
            student = Student.query.filter_by(user_id=current_user.id).first()
            if not student or student.id != counseling_session.student_id:
                emit('error', {'message': 'Unauthorized'})
                return
        else:
            # Super admin can update any session
            pass
            
        # Update the status
        previous_status = counseling_session.status
        counseling_session.status = status
        counseling_session.last_updated_at = datetime.utcnow()
        
        # Add update information
        if data.get('notes'):
            counseling_session.notes = data.get('notes')
            
        db.session.commit()
        
        # Log the activity
        if current_user.role == 'office_admin':
            AuditLog.log_action(
                actor=current_user,
                action=f"Updated counseling session status from {previous_status} to {status}",
                target_type="counseling_session",
                target_id=session_id
            )
        
        # Get room name
        room = f"counseling_{session_id}"
        
        # Emit to everyone in the room
        emit('counseling_status_changed', {
            'session_id': session_id,
            'status': status,
            'updated_by': current_user.get_full_name(),
            'updated_by_role': current_user.role,
            'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        }, room=room)
        
        # Also emit to office room if applicable
        if counseling_session.office_id:
            emit('counseling_status_changed', {
                'session_id': session_id,
                'status': status,
                'updated_by': current_user.get_full_name(),
                'updated_by_role': current_user.role,
                'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            }, room=f'office_{counseling_session.office_id}', namespace='/')
    
    @socketio.on('counseling_message', namespace='/counseling')
    def handle_counseling_message(data):
        """Handle messages sent during counseling sessions"""
        if not current_user.is_authenticated:
            return
            
        session_id = data.get('session_id')
        content = data.get('content')
        
        if not session_id or not content:
            return
            
        # Verify session exists
        counseling_session = CounselingSession.query.get(session_id)
        if not counseling_session:
            emit('error', {'message': 'Invalid session'})
            return
            
        # Get room name
        room = f"counseling_{session_id}"
        
        # Send message to room
        emit('new_counseling_message', {
            'sender_id': current_user.id,
            'sender_name': current_user.get_full_name(),
            'sender_role': current_user.role,
            'content': content,
            'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        }, room=room)
    
    @socketio.on('schedule_change', namespace='/counseling')
    def handle_schedule_change(data):
        """Handle changes to counseling session schedule"""
        if not current_user.is_authenticated or current_user.role != 'office_admin':
            emit('error', {'message': 'Unauthorized'})
            return
            
        session_id = data.get('session_id')
        new_date = data.get('new_date')
        new_time = data.get('new_time')
        
        if not session_id or not new_date or not new_time:
            emit('error', {'message': 'Missing required data'})
            return
            
        # Update schedule in database
        counseling_session = CounselingSession.query.get(session_id)
        if not counseling_session:
            emit('error', {'message': 'Invalid session'})
            return
            
        # Parse new date and time
        try:
            # Combine date and time into a datetime object
            from datetime import datetime
            import dateutil.parser
            scheduled_at = dateutil.parser.parse(f"{new_date} {new_time}")
            counseling_session.scheduled_at = scheduled_at
            counseling_session.last_updated_at = datetime.utcnow()
            db.session.commit()
            
            # Get room name
            room = f"counseling_{session_id}"
            
            # Emit to everyone in the room
            emit('counseling_schedule_updated', {
                'session_id': session_id,
                'new_date': new_date,
                'new_time': new_time,
                'formatted_datetime': scheduled_at.strftime('%Y-%m-%d %H:%M'),
                'updated_by': current_user.get_full_name()
            }, room=room)
            
            # Also emit to student's personal room
            student_user_id = User.query.join(Student).filter(Student.id == counseling_session.student_id).first().id
            emit('counseling_schedule_updated', {
                'session_id': session_id,
                'new_date': new_date,
                'new_time': new_time,
                'formatted_datetime': scheduled_at.strftime('%Y-%m-%d %H:%M'),
                'counselor_name': current_user.get_full_name()
            }, room=f'user_{student_user_id}', namespace='/')
            
            # Log the activity
            AuditLog.log_action(
                actor=current_user,
                action=f"Rescheduled counseling session to {scheduled_at}",
                target_type="counseling_session",
                target_id=session_id
            )
            
        except Exception as e:
            db.session.rollback()
            emit('error', {'message': f'Error updating schedule: {str(e)}'})