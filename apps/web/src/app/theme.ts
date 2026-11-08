import type { GlobalThemeOverrides } from "naive-ui";

// CSS tokens are the only color source. Read after index.css has loaded and before mounting providers.
export function createTheme(style: Pick<CSSStyleDeclaration, "getPropertyValue">): GlobalThemeOverrides {
  const token = (name: string) => style.getPropertyValue(name).trim() || undefined;
  return {
    common: {
      primaryColor: token("--color-primary-600"),
      primaryColorHover: token("--color-primary-700"),
      primaryColorPressed: token("--color-primary-800"),
      primaryColorSuppl: token("--color-primary-700"),
      infoColor: token("--color-primary-600"),
      successColor: token("--color-success"),
      warningColor: token("--color-warning"),
      errorColor: token("--color-error"),
      textColorBase: token("--color-text"),
      textColor2: token("--color-text-secondary"),
      textColor3: token("--color-text-secondary"),
      bodyColor: token("--color-canvas"),
      cardColor: token("--color-surface"),
      modalColor: token("--color-surface"),
      borderColor: token("--color-border"),
      borderRadius: token("--radius-control"),
      fontFamily: token("--font-ui"),
      fontSize: "14px"
    },
    Button: {
      borderRadiusMedium: "8px",
      heightMedium: "40px",
      heightLarge: "44px"
    },
    Card: { borderRadius: "14px", paddingMedium: "20px", paddingLarge: "24px" },
    Dialog: { borderRadius: "16px" },
    Input: { borderRadius: "8px", heightMedium: "40px" },
    Select: {
      peers: {
        InternalSelection: { borderRadius: "8px", heightMedium: "40px" }
      }
    },
    Progress: { fillColor: token("--color-primary-600") }
  };
}
