const { RuleTester } = require("eslint");
const rule = require("./form");

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
});

const message = "Should upgrade getFieldDecorator to antd@4";
const formMessage = "Should not have `form` at function params";

ruleTester.run("form", rule, {
  valid: [],
  invalid: [
    {
      code: `
        function Foo({form, a}) {}
        export default Form.create()(Foo)
      `,
      output: `
        function Foo({ a}) {
const [form] = Form.useForm();
}
        export default Form.create()(Foo)
      `,
      errors: [
        {
          message: formMessage,
          type: "Property",
        },
      ],
    },
    {
      code: `
        function Foo({form: {a,b}}) {}
        export default Form.create()(Foo)
      `,
      errors: [
        {
          message: formMessage,
          type: "Property",
        },
      ],
    },
    {
      code: `
        function Foo({form: {a,b}}) {
          const [form] = Form.useForm();
        }
        export default Form.create()(Foo)
      `,
      output: `
        function Foo({}) {
          const [form] = Form.useForm();
const {a,b} = form;

        }
        export default Form.create()(Foo)
      `,
      errors: [
        {
          message: formMessage,
          type: "Property",
        },
      ],
    },
    {
      code: `
        <Form.Item label="a">
          {getFieldDecorator("memberId")(<Input />)}
        </Form.Item>
      `,
      output: `
        <Form.Item label="a" name="memberId">
          <Input />
        </Form.Item>
      `,
      errors: [
        {
          message,
          type: "JSXElement",
        },
      ],
    },
    {
      code: `
        <Form.Item label="a">
          {getFieldDecorator(\`memberId\`)(<Input />)}
        </Form.Item>
      `,
      output: `
        <Form.Item label="a" name="memberId">
          <Input />
        </Form.Item>
      `,
      errors: [
        {
          message,
          type: "JSXElement",
        },
      ],
    },
    {
      code: `
        <Form.Item label="a">
          {getFieldDecorator("memberId", {
            rules: [
              { required: true, message: '必填' },
            ],
          })(<Input />)}
        </Form.Item>
      `,
      output: `
        <Form.Item label="a" name="memberId" rules={[
              { required: true, message: '必填' },
            ]}>
          <Input />
        </Form.Item>
      `,
      errors: [
        {
          message,
          type: "JSXElement",
        },
      ],
    },
  ],
});

module.exports = rule;
