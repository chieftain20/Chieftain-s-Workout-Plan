"""Compatibility entry point for the weekly Summary regression tests.

The production Summary is validated by test_scientific_summary.py.
"""
exec((__import__('pathlib').Path(__file__).with_name('test_scientific_summary.py')).read_text(encoding='utf-8'), globals())
