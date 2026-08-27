# Security Specification: Patient Records DB

## Data Invariants
1. A patient record must have a unique serial number.
2. Only authenticated users can create or read patient records.
3. Age must be a positive number.
4. Gender must be one of: Male, Female, Other.
5. `serialNo` is immutable after creation.
6. `createdAt` and `createdBy` are immutable.

## The Dirty Dozen Payloads (Target: /patients/{id})

1. **Identity Spoofing**: `{"name": "John", "serialNo": 1, "createdBy": "OTHER_UID", ...}` -> Should fail because `createdBy` != `request.auth.uid`.
2. **Missing Required Fields**: `{"name": "John"}` -> Should fail (missing age, gender, etc).
3. **Invalid Data Type (Age)**: `{"age": "twenty", ...}` -> Should fail (must be number).
4. **Invalid Enum (Gender)**: `{"gender": "Robot", ...}` -> Should fail.
5. **Malicious ID**: Attempting to write to `/patients/JUNK_CHARACTERS_1.5KB_LONG`.
6. **Shadow Fields**: `{"name": "John", ..., "isAdmin": true}` -> Should fail because of strict key checking.
7. **Bypassing Serial Number**: Attempting to update `serialNo` after creation.
8. **Tampering with Timestamps**: `{"createdAt": "2000-01-01", ...}` -> Should fail (must match `request.time`).
9. **Unauthenticated Read**: Attempting to read without login.
10. **Query Scrape**: Attempting to list all patients without filtering by authorized criteria (if applied).
11. **Negative Age**: `{"age": -5, ...}` -> Should fail.
12. **Oversized String**: `{"name": "A" * 2000, ...}` -> Should fail (size limit).

## Test Runner (Draft)
A `firestore.rules.test.ts` would verify these using `@firebase/rules-unit-testing`.
Since I'm building the app directly, I'll ensure the rules handle these cases.
