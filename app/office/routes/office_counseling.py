from app.models import (
    Inquiry, InquiryMessage, User, Office, db, OfficeAdmin, 
    Student, CounselingSession, StudentActivityLog, SuperAdminActivityLog, 
    OfficeLoginLog, AuditLog, Announcement, SessionParticipation, 
    SessionRecording, SessionReminder
)
from flask import Blueprint, redirect, url_for, render_template, jsonify, request, flash, Response
from flask_login import login_required, current_user
from datetime import datetime, timedelta
from sqlalchemy import func, desc
from app.office import office_bp
from app.office.routes.office_dashboard import get_office_context
import uuid
import os


@office_bp.route('/video-counseling')
@login_required
def video_counseling():
    """View all video counseling sessions for the office"""
    if current_user.role != 'office_admin':
        flash('Access denied. You do not have permission to view this page.', 'error')
        return redirect(url_for('main.index'))
    
    office_id = current_user.office_admin.office_id
    
    # Get filter parameters
    status = request.args.get('status', 'upcoming')
    date_range = request.args.get('date_range', '7d')
    page = request.args.get('page', 1, type=int)
    
    # Only get video sessions
    query = CounselingSession.query.filter_by(
        office_id=office_id,
        is_video_session=True
    )
    
    # Apply status filter
    now = datetime.utcnow()
    if status == 'upcoming':
        query = query.filter(
            CounselingSession.status.in_(['pending', 'confirmed']),
            CounselingSession.scheduled_at > now
        )
    elif status == 'today':
        today_start = datetime.combine(now.date(), datetime.min.time())
        today_end = datetime.combine(now.date(), datetime.max.time())
        query = query.filter(
            CounselingSession.scheduled_at >= today_start,
            CounselingSession.scheduled_at <= today_end
        )
    elif status == 'active':
        query = query.filter(
            CounselingSession.status == 'in_progress'
        )
    elif status == 'past':
        query = query.filter(
            CounselingSession.status == 'completed'
        )
    elif status != 'all':
        query = query.filter_by(status=status)
    
    # Apply date range filter
    if date_range == '7d' and status == 'upcoming':
        query = query.filter(CounselingSession.scheduled_at <= now + timedelta(days=7))
    elif date_range == '30d' and status == 'upcoming':
        query = query.filter(CounselingSession.scheduled_at <= now + timedelta(days=30))
    elif date_range == '7d' and status == 'past':
        query = query.filter(CounselingSession.scheduled_at >= now - timedelta(days=7))
    elif date_range == '30d' and status == 'past':
        query = query.filter(CounselingSession.scheduled_at >= now - timedelta(days=30))
    
    # Filter by counselor (only show sessions assigned to the current user)
    if request.args.get('my_sessions', 'false') == 'true':
        query = query.filter_by(counselor_id=current_user.id)
    
    # Sort by scheduled date
    if status == 'upcoming' or status == 'today':
        query = query.order_by(CounselingSession.scheduled_at)
    else:
        query = query.order_by(desc(CounselingSession.scheduled_at))
    
    # Paginate results
    video_sessions = query.paginate(page=page, per_page=10, error_out=False)
    
    # Get stats for sidebar
    today_start = datetime.combine(now.date(), datetime.min.time())
    today_end = datetime.combine(now.date(), datetime.max.time())
    
    today_video_count = CounselingSession.query.filter(
        CounselingSession.office_id == office_id,
        CounselingSession.is_video_session == True,
        CounselingSession.scheduled_at >= today_start,
        CounselingSession.scheduled_at <= today_end
    ).count()
    
    active_video_count = CounselingSession.query.filter(
        CounselingSession.office_id == office_id,
        CounselingSession.is_video_session == True,
        CounselingSession.status == 'in_progress'
    ).count()
    
    upcoming_video_count = CounselingSession.query.filter(
        CounselingSession.office_id == office_id,
        CounselingSession.is_video_session == True,
        CounselingSession.status.in_(['pending', 'confirmed']),
        CounselingSession.scheduled_at > now
    ).count()
    
    completed_video_count = CounselingSession.query.filter(
        CounselingSession.office_id == office_id,
        CounselingSession.is_video_session == True,
        CounselingSession.status == 'completed'
    ).count()
    
    my_upcoming_sessions = CounselingSession.query.filter(
        CounselingSession.office_id == office_id,
        CounselingSession.is_video_session == True,
        CounselingSession.counselor_id == current_user.id,
        CounselingSession.status.in_(['pending', 'confirmed']),
        CounselingSession.scheduled_at > now
    ).order_by(CounselingSession.scheduled_at).limit(5).all()
    
    # Calculate count of pending inquiries for the notification badge
    pending_inquiries_count = Inquiry.query.filter_by(
        office_id=office_id, 
        status='pending'
    ).count()
    
    context = get_office_context()
    context.update({
        'video_sessions': video_sessions,
        'status': status,
        'date_range': date_range,
        'today_video_count': today_video_count,
        'active_video_count': active_video_count,
        'upcoming_video_count': upcoming_video_count,
        'completed_video_count': completed_video_count,
        'my_upcoming_sessions': my_upcoming_sessions,
        'pending_inquiries_count': pending_inquiries_count,
        'now': now
    })
    
    return render_template('office/office_counseling.html', **context)


@office_bp.route('/video-session/<int:session_id>')
@login_required
def join_video_session(session_id):
    """Join a specific video counseling session"""
    if current_user.role != 'office_admin':
        flash('Access denied. You do not have permission to access this page.', 'error')
        return redirect(url_for('main.index'))
    
    office_id = current_user.office_admin.office_id
    session = CounselingSession.query.filter_by(
        id=session_id, 
        office_id=office_id,
        is_video_session=True
    ).first_or_404()
    
    # Check if counselor is assigned to this session
    if session.counselor_id != current_user.id:
        flash('You are not assigned as the counselor for this session.', 'warning')
        return redirect(url_for('office.video_counseling'))
    
    # Check if session is already completed
    if session.status == 'completed':
        flash('This session has already been completed.', 'info')
        return redirect(url_for('office.video_counseling'))
    
    # Check if session is cancelled
    if session.status == 'cancelled':
        flash('This session has been cancelled.', 'warning')
        return redirect(url_for('office.video_counseling'))
    
    # Get student information
    student = Student.query.get(session.student_id)
    student_user = User.query.get(student.user_id)
    
    # If session doesn't have meeting details, generate them
    if not session.meeting_id:
        session.generate_meeting_details()
        db.session.commit()
    
    # Update the session status if it's pending and within 5 minutes of scheduled time
    now = datetime.utcnow()
    scheduled_time = session.scheduled_at
    
    if session.status in ['pending', 'confirmed'] and \
       scheduled_time - timedelta(minutes=5) <= now <= scheduled_time + timedelta(minutes=15):
        session.status = 'in_progress'
        db.session.commit()
    
    # Log counselor joining the session
    session.counselor_joined_at = now
    
    # Create participation record
    participation = SessionParticipation(
        session_id=session_id,
        user_id=current_user.id,
        joined_at=now,
        device_info=request.user_agent.string,
        ip_address=request.remote_addr
    )
    db.session.add(participation)
    
    # Log activity
    AuditLog.log_action(
        actor=current_user,
        action="Joined video counseling session",
        target_type="counseling_session",
        status=session.status,
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string
    )
    
    db.session.commit()
    
    # Calculate count of pending inquiries for the notification badge
    pending_inquiries_count = Inquiry.query.filter_by(
        office_id=office_id, 
        status='pending'
    ).count()
    
    context = get_office_context()
    context.update({
        'session': session,
        'student': student,
        'student_user': student_user,
        'meeting_url': session.meeting_url,
        'meeting_id': session.meeting_id,
        'meeting_password': session.meeting_password,
        'pending_inquiries_count': pending_inquiries_count
    })
    
    return render_template('office/video_session.html', **context)


@office_bp.route('/video-session/<int:session_id>/end', methods=['POST'])
@login_required
def end_video_session(session_id):
    """End a video counseling session"""
    if current_user.role != 'office_admin':
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 403
    
    session = CounselingSession.query.filter_by(
        id=session_id,
        is_video_session=True
    ).first_or_404()
    
    # Check if counselor is assigned to this session
    if session.counselor_id != current_user.id:
        return jsonify({'status': 'error', 'message': 'You are not assigned as the counselor for this session'}), 403
    
    # Update session status
    session.status = 'completed'
    session.session_ended_at = datetime.utcnow()
    
    # Update participation record
    participation = SessionParticipation.query.filter_by(
        session_id=session_id,
        user_id=current_user.id,
        left_at=None
    ).order_by(desc(SessionParticipation.joined_at)).first()
    
    if participation:
        participation.left_at = datetime.utcnow()
    
    # Get notes from the request
    notes = request.form.get('notes', '')
    if notes:
        session.notes = notes
    
    # Handle recording if it exists
    recording_data = request.form.get('recording_data')
    if recording_data:
        # Create directory if it doesn't exist
        recordings_dir = os.path.join('static', 'uploads', 'recordings')
        if not os.path.exists(recordings_dir):
            os.makedirs(recordings_dir)
        
        # Save recording file
        recording_filename = f"session_{session_id}_{uuid.uuid4().hex}.webm"
        recording_path = os.path.join(recordings_dir, recording_filename)
        
        # Save recording to file
        with open(recording_path, 'wb') as f:
            f.write(recording_data)
        
        # Create recording record
        recording = SessionRecording(
            session_id=session_id,
            recording_path=recording_path,
            counselor_consent=True,  # Counselor recorded it
            student_consent=request.form.get('student_consent', 'false') == 'true'
        )
        db.session.add(recording)
    
    # Log activity
    AuditLog.log_action(
        actor=current_user,
        action="Ended video counseling session",
        target_type="counseling_session",
        status='completed',
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string
    )
    
    db.session.commit()
    
    return jsonify({'status': 'success', 'message': 'Session ended successfully'})


@office_bp.route('/video-session/<int:session_id>/update-status', methods=['POST'])
@login_required
def update_session_status(session_id):
    """Update status of a counseling session"""
    if current_user.role != 'office_admin':
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 403
    
    session = CounselingSession.query.filter_by(id=session_id).first_or_404()
    
    # Check if office admin belongs to the office
    if session.office_id != current_user.office_admin.office_id:
        return jsonify({'status': 'error', 'message': 'You do not have permission to update this session'}), 403
    
    new_status = request.form.get('status')
    if new_status not in ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no-show']:
        return jsonify({'status': 'error', 'message': 'Invalid status'}), 400
    
    # Update session status
    old_status = session.status
    session.status = new_status
    
    # If cancelling, record cancellation reason
    if new_status == 'cancelled':
        reason = request.form.get('reason', '')
        if session.notes:
            session.notes += f"\n\nCancellation reason: {reason}"
        else:
            session.notes = f"Cancellation reason: {reason}"
    
    # Log activity
    AuditLog.log_action(
        actor=current_user,
        action="Updated video session status",
        target_type="counseling_session",
        status=new_status,
        details=f"Changed status from '{old_status}' to '{new_status}'",
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string
    )
    
    db.session.commit()
    
    return jsonify({'status': 'success', 'message': f'Session status updated to {new_status}'})


@office_bp.route('/video-session/<int:session_id>/send-reminder', methods=['POST'])
@login_required
def send_session_reminder(session_id):
    """Send a reminder for a counseling session"""
    if current_user.role != 'office_admin':
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 403
    
    session = CounselingSession.query.filter_by(id=session_id).first_or_404()
    
    # Check if office admin belongs to the office
    if session.office_id != current_user.office_admin.office_id:
        return jsonify({'status': 'error', 'message': 'You do not have permission for this session'}), 403
    
    reminder_type = request.form.get('type', 'in_app')
    
    # Get the student
    student = Student.query.get(session.student_id)
    student_user = User.query.get(student.user_id)
    
    reminder = SessionReminder(
        session_id=session_id,
        user_id=student_user.id,
        reminder_type=reminder_type,
        scheduled_at=datetime.utcnow(),
        sent_at=datetime.utcnow(),
        status='sent'
    )
    db.session.add(reminder)
    
    # For in-app notifications, create a notification
    if reminder_type == 'in_app':
        from app.models import Notification
        
        notification = Notification(
            user_id=student_user.id,
            title="Counseling Reminder",
            message=f"Reminder: You have a video counseling session scheduled for {session.scheduled_at.strftime('%Y-%m-%d %H:%M')}. Please be ready to join the session on time."
        )
        db.session.add(notification)
    
    # Log activity
    AuditLog.log_action(
        actor=current_user,
        action="Sent session reminder",
        target_type="counseling_session",
        status=session.status,
        details=f"Sent {reminder_type} reminder",
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string
    )
    
    db.session.commit()
    
    return jsonify({
        'status': 'success', 
        'message': f'{reminder_type.capitalize()} reminder sent to student'
    })