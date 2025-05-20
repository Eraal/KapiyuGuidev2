from flask import Blueprint, render_template
from werkzeug.security import generate_password_hash

# Replace 'admin' with any password you want to hash
plain_password = "admin"
hashed_password = generate_password_hash(plain_password)

print("Hashed password:", hashed_password)

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    return render_template('index.html')

@main_bp.route('/offices')
def offices():
    return render_template('offices.html')

@main_bp.route('/securityprivacy')
def securityprivacy():
    return render_template('securityprivacy.html')

@main_bp.route('/register')
def register():
    return render_template('auth/register.html')