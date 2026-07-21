import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .services import alpha


def helper():
    return os.getcwd()


def extra():
    return 2
