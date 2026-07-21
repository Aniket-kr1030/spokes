from . import alpha
from ..util import helper

__all__ = ["b_run"]


def b_run():
    return alpha.run() + helper()


def b_extra():
    return 0
