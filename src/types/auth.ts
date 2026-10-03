export interface LoginFormData {
  identifier: string; // Email or Mobile Number
  password: string;
}

export interface SignupFormData {
  fullName: string;
  email: string;
  mobileNumber: string;
  selectedClass: string;
  selectedBoard: string;
  password: string;
  confirmPassword: string;
}

export interface FormValidationErrors {
  [key: string]: string;
}
