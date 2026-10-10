import io
import pandas as pd
import pytest
from app.data.validation import (ValidationError, read_table, validate_extension,
                                 validate_schema, validate_size)


def code(fn, *a, **k):
    with pytest.raises(ValidationError) as e:
        fn(*a, **k)
    return e.value.code


def test_wrong_extension():
    assert code(validate_extension, "data.txt") == "INVALID_FILE_TYPE"

def test_too_large():
    assert code(validate_size, 3 * 1024 * 1024, 2) == "FILE_TOO_LARGE"

def test_empty_file():
    assert code(read_table, b"", "x.csv") == "EMPTY_FILE"

def test_missing_columns(df):
    assert code(validate_schema, df.drop(columns=["Amount"])) == "MISSING_COLUMNS"

def test_non_numeric_column(df):
    bad = df.copy(); bad["V1"] = "abc"
    assert code(validate_schema, bad) == "SCHEMA_MISMATCH"

def test_invalid_target(df):
    bad = df.copy(); bad.loc[0, "Class"] = 5
    assert code(validate_schema, bad) == "INVALID_TARGET"

def test_single_class(df):
    bad = df.copy(); bad["Class"] = 0
    assert code(validate_schema, bad) == "SINGLE_CLASS"

def test_valid_roundtrip_csv(df):
    buf = df.to_csv(index=False).encode()
    out = read_table(buf, "x.csv")
    validate_schema(out)
    assert len(out) == len(df)
