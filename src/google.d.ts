interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
}

interface GoogleButtonConfig {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  width?: string | number;
}

interface Google {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
      }): void;
      renderButton(parent: HTMLElement, config: GoogleButtonConfig): void;
      prompt(): void;
      disableAutoSelect(): void;
    };
  };
}

interface Window {
  google?: Google;
}
