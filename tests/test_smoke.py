from app.main import app

def test_app_title():
    print("Start testing")
    assert app.title == "AegisAi"