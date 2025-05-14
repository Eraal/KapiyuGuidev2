from flask import render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime, timedelta
from sqlalchemy import desc
from app.student import student_bp
from app.models import (
    CounselingSession, Student, User, Office, 
    StudentActivityLog, Notification, OfficeConcernType, ConcernType
)
from app.extensions import db
from app.utils import role_required

@student_bp.route('/counseling-sessions')
@login_required
@role_required(['student'])
def counseling_sessions():
    """View all counseling sessions for the student"""
    # Get the student record
    student = Student.query.filter_by(user_id=current_user.id).first_or_404()
    
    # Get all sessions for this student
    sessions = CounselingSession.query.filter_by(
        student_id=student.id
    ).order_by(desc(CounselingSession.scheduled_at)).all()
    
    # Get all offices for scheduling
    offices = Office.query.all()
    
    # Get unread notifications count for navbar
    unread_notifications_count = Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False
    ).count()
    
    # Get notifications for dropdown
    notifications = Notification.query.filter_by(
        user_id=current_user.id
    ).order_by(desc(Notification.created_at)).limit(5).all()
    
    # Log this activity
    log_entry = StudentActivityLog(
        student_id=student.id,
        action="Viewed counseling sessions",
        timestamp=datetime.utcnow(),
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string
    )
    db.session.add(log_entry)
    db.session.commit()
    
    return render_template(
        'student/counseling_sessions.html',
        sessions=sessions,
        offices=offices,
        unread_notifications_count=unread_notifications_count,
        notifications=notifications
    )

@student_bp.route('/view-session/<int:session_id>')
@login_required
@role_required(['student'])
def view_session(session_id):
    """View details for a specific counseling session"""
    # Get the student record
    student = Student.query.filter_by(user_id=current_user.id).first_or_404()
    
    # Get the session and verify ownership
    session = CounselingSession.query.filter_by(
        id=session_id,
        student_id=student.id
    ).first_or_404()
    
    # Get unread notifications count for navbar
    unread_notifications_count = Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False
    ).count()
    
    # Get notifications for dropdown
    notifications = Notification.query.filter_by(
        user_id=current_user.id
    ).order_by(desc(Notification.created_at)).limit(5).all()
    
    # Log this activity
    log_entry = StudentActivityLog(
        student_id=student.id,
        action=f"Viewed counseling session #{session_id}",
        timestamp=datetime.utcnow(),
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string
    )
    db.session.add(log_entry)
    db.session.commit()
    
    # Placeholder - return a simple template
    return render_template(
        'student/view_session.html',
        session=session,
        unread_notifications_count=unread_notifications_count,
        notifications=notifications
    )

@student_bp.route('/schedule-session', methods=['POST'])
@login_required
@role_required(['student'])
def schedule_session():
    """Schedule a new counseling session"""
    # Get form data
    office_id = request.form.get('office_id')
    scheduled_date = request.form.get('scheduled_date')
    scheduled_time = request.form.get('scheduled_time')
    is_video = request.form.get('is_video') == 'true'  # Handle string value 'true' vs 'false'
    notes = request.form.get('notes', '')
    
    # Validate required fields
    if not office_id or not scheduled_date or not scheduled_time:
        flash('Please fill all required fields', 'error')
        return redirect(url_for('student.request_counseling_session'))
    
    try:
        # Parse the date and time
        scheduled_datetime = datetime.strptime(f"{scheduled_date} {scheduled_time}", '%Y-%m-%d %H:%M')
        
        # Ensure the appointment is in the future
        if scheduled_datetime <= datetime.utcnow():
            flash('Appointment must be scheduled for a future date and time', 'error')
            return redirect(url_for('student.request_counseling_session'))
        
        # Get the student record
        student = Student.query.filter_by(user_id=current_user.id).first_or_404()
        
        # Verify the office exists
        office = Office.query.get_or_404(office_id)
        
        # If video session is requested, verify office supports it
        if is_video and not office.supports_video:
            flash('The selected office does not support video counseling', 'error')
            return redirect(url_for('student.request_counseling_session'))
        
        # Create new counseling session
        new_session = CounselingSession(
            student_id=student.id,
            office_id=office_id,
            scheduled_at=scheduled_datetime,
            status='pending',
            is_video_session=is_video,
            notes=notes,
            counselor_id=None  # Will be assigned by office admin
        )
        db.session.add(new_session)
        
        # Log this activity
        log_entry = StudentActivityLog(
            student_id=student.id,
            action="Scheduled new counseling session",
            details=f"Office ID: {office_id}, Scheduled at: {scheduled_datetime}, Video: {is_video}",
            timestamp=datetime.utcnow(),
            ip_address=request.remote_addr,
            user_agent=request.user_agent.string
        )
        db.session.add(log_entry)
        
        db.session.commit()
        flash('Counseling session scheduled successfully', 'success')
        return redirect(url_for('student.view_session', session_id=new_session.id))
        
    except Exception as e:
        db.session.rollback()
        flash(f'Error scheduling session: {str(e)}', 'error')
        return redirect(url_for('student.request_counseling_session'))

@student_bp.route('/request-counseling-session')
@login_required
@role_required(['student'])
def request_counseling_session():
    """Display form to request a new counseling session"""
    # Get the student record
    student = Student.query.filter_by(user_id=current_user.id).first_or_404()
    
    # Get all offices for selecting where to schedule a session
    offices = Office.query.all()
    
    # Count offices that have counseling sessions (using the relationship)
    # An office supports counseling if it has counseling_sessions relationship
    counseling_offices = []
    for office in offices:
        # Consider an office as supporting counseling if it has the counseling_sessions relationship
        # We can identify offices that support counseling by checking if they have been used for sessions before
        # or by checking if they have counselors assigned
        if hasattr(office, 'counseling_sessions'):
            counseling_offices.append(office)
    
    counseling_offices_count = len(counseling_offices)
    
    # Get unread notifications count for navbar
    unread_notifications_count = Notification.query.filter_by(
        user_id=current_user.id,
        is_read=False
    ).count()
    
    # Get notifications for dropdown
    notifications = Notification.query.filter_by(
        user_id=current_user.id
    ).order_by(desc(Notification.created_at)).limit(5).all()
    
    # Get date constraints for the form
    today = datetime.utcnow().date().strftime('%Y-%m-%d')
    max_date = (datetime.utcnow() + timedelta(days=30)).date().strftime('%Y-%m-%d')
    
    # Log this activity
    log_entry = StudentActivityLog(
        student_id=student.id,
        action="Viewed counseling session request form",
        timestamp=datetime.utcnow(),
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string
    )
    db.session.add(log_entry)
    db.session.commit()
    
    return render_template(
        'student/request_counseling.html',
        offices=offices,
        counseling_offices_count=counseling_offices_count,
        today=today,
        max_date=max_date,
        unread_notifications_count=unread_notifications_count,
        notifications=notifications
    )

@student_bp.route('/office/<int:office_id>/check-video-support')
@login_required
@role_required(['student'])
def check_office_video_support(office_id):
    """API endpoint to check if an office supports video counseling"""
    office = Office.query.get_or_404(office_id)
    
    # Log this API call
    student = Student.query.filter_by(user_id=current_user.id).first()
    log_entry = StudentActivityLog(
        student_id=student.id,
        action=f"Checked video support for office: {office.name}",
        timestamp=datetime.utcnow(),
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string
    )
    db.session.add(log_entry)
    db.session.commit()
    
    return jsonify({
        'supports_video': office.supports_video,
        'office_name': office.name
    })