export type ButtonVariant = 'contained' | 'outlined' | 'text';
export type ButtonColor = 'primary' | 'secondary' | 'surface';

export interface LubanButtonProps {
  variant?: ButtonVariant;
  color?: ButtonColor;
  disabled?: boolean;
  block?: boolean;
  type?: 'button' | 'submit' | 'reset';
  content?: string;
}
