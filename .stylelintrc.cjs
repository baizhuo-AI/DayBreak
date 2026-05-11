module.exports = {
  extends: ["stylelint-config-standard"],
  ignoreFiles: ["dist/**/*", "node_modules/**/*"],
  overrides: [
    {
      files: ["src/styles/tokens.css"],
      rules: {
        "color-hex-length": null,
        "custom-property-empty-line-before": null,
        "declaration-property-value-disallowed-list": null
      }
    }
  ],
  rules: {
    "alpha-value-notation": "number",
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: ["tailwind", "apply", "layer", "variants", "responsive", "screen"]
      }
    ],
    "import-notation": null,
    "declaration-property-value-disallowed-list": {
      "/color$/": ["/#/", "/rgb\\(/", "/hsl\\(/"],
      "box-shadow": ["/(?!var\\().+/"],
      "/^(margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|min-width|min-height|max-width|max-height|width|height)$/": [
        "/^(?!0$|100%$|auto$|inherit$|unset$|initial$|var\\().+/"
      ]
    },
    "custom-property-pattern": "^([a-z0-9]+-)*[a-z0-9]+$",
    "rule-empty-line-before": [
      "always-multi-line",
      {
        except: ["first-nested"],
        ignore: ["after-comment"]
      }
    ]
  }
};
