"""Entry point; a hub may import as much as it likes."""
import app.services.alpha
from app.services import beta
from app.util import helper
from app.overused import over


def main():
    helper()
    beta.b_run()
    app.services.alpha.run()
    over()
