const config = {
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  addons: ["@storybook/addon-docs"],
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
};

export default config;
