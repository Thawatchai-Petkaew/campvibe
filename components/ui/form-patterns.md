# Form Error Handling Pattern

## Overview
This document describes the standard pattern for handling form errors in the application.

## Pattern Structure

### 1. Inline Messages (Default)
- **Location**: Below the input field
- **Use Case**: Client-side validation errors (format, required fields, etc.)
- **Component**: `InputField` component automatically handles this
- **Example**: Email format validation, password length, etc.

### 2. Error Banner (Server Errors)
- **Location**: Top of the form (before input fields)
- **Use Case**: Server-side errors after form submission
- **Component**: `ErrorBanner` component
- **Example**: Invalid credentials, server errors, network errors

## Implementation Pattern

```tsx
// 1. State Management
const [hasSubmitted, setHasSubmitted] = useState(false);
const [serverError, setServerError] = useState<string | null>(null);

// 2. Client-side validation (inline)
const emailValidationError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? "Please include an '@' in the email address. '" + email + "' is missing an '@'."
    : undefined;

// 3. Form submission handler
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    setServerError(null);
    
    try {
        // ... form submission logic
        if (res.ok) {
            // Success
            setHasSubmitted(false);
        } else {
            // Server error
            const err = await res.json();
            setServerError(err.error || "Failed to save");
        }
    } catch (error) {
        setServerError("Something went wrong. Please try again.");
    }
};

// 4. Form JSX
<form noValidate onSubmit={handleSubmit}>
    {/* Server Error Banner (after submit) */}
    {hasSubmitted && serverError && (
        <ErrorBanner message={serverError} />
    )}
    
    {/* Input Fields with inline validation */}
    <InputField
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={emailValidationError} // Inline error
    />
</form>
```

## Rules

1. **Inline Messages**: Always use for client-side validation
   - Format validation (email, URL, etc.)
   - Required field validation
   - Length/range validation
   - Real-time feedback

2. **Error Banner**: Only use for server-side errors
   - After form submission
   - Network errors
   - Authentication errors
   - Server validation errors

3. **State Management**:
   - `hasSubmitted`: Track if form has been submitted
   - `serverError`: Store server error message
   - Reset `hasSubmitted` on success

4. **Form Attributes**:
   - Always use `noValidate` on `<form>` to disable HTML5 validation
   - Use custom validation instead

## Components

- `InputField`: Handles inline error messages automatically
- `ErrorBanner`: Displays server errors in a banner format

## Examples

See:
- `components/LoginModal.tsx`
- `components/RegisterModal.tsx`
- `app/login/page.tsx`
- `app/register/page.tsx`
- `app/profile/page.tsx`
- `components/CampgroundForm.tsx`
