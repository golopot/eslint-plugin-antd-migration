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
const formMessage = "Should not have `form` at props";

ruleTester.run("form", rule, {
  valid: [],
  invalid: [
    {
      code: `
const Foo = ({form}) => {}
export default Form.create()(Foo)
`,
      output: `
const Foo = ({}) => {
const [form] = Form.useForm();}
export default (Foo)
`,
      errors: [
        {
          message: formMessage,
          type: "ObjectPattern",
        },
      ],
    },
    {
      code: `
function Foo({form, a}) {}
export default Form.create()(Foo)
`,
      output: `
function Foo({ a}) {
const [form] = Form.useForm();}
export default (Foo)
`,
      errors: [
        {
          message: formMessage,
          type: "ObjectPattern",
        },
      ],
    },
    {
      code: `
function Foo({form: {a,b}}) {}
export default Form.create()(Foo)
`,
      output: `
function Foo({}) {
const [form] = Form.useForm();const {a,b} = form;}
export default (Foo)
`,
      errors: [
        {
          message: formMessage,
          type: "ObjectPattern",
        },
      ],
    },
    {
      code: `
function Foo({form, form: {a,b}}) {}
export default Form.create()(Foo)
`,
      output: `
function Foo({ }) {
const [form] = Form.useForm();const {a,b} = form;}
export default (Foo)
`,
      errors: [
        {
          message: formMessage,
          type: "ObjectPattern",
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
        <Form.Item label="a" name={\`memberId\`}>
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
          {getFieldDecorator(\`a\${b}c\`)(<Input />)}
        </Form.Item>
      `,
      output: `
        <Form.Item label="a" name={\`a\${b}c\`}>
          <Input />
        </Form.Item>
      `,
      errors: [{ message, type: "JSXElement" }],
    },
    {
      code: `
        <Form.Item label="a">
          {getFieldDecorator(a.b)(<Input />)}
        </Form.Item>
      `,
      output: `
        <Form.Item label="a" name={a.b}>
          <Input />
        </Form.Item>
      `,
      errors: [{ message, type: "JSXElement" }],
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
    {
      code: `
        const { getFieldDecorator, getFieldValue } = form;
      `,
      output: `
        const {  getFieldValue } = form;
      `,
      errors: [
        {
          message: "remove getFieldDecorator",
          type: "Property",
        },
      ],
    },
    {
      code: `
        const { getFieldDecorator } = form;
      `,
      output: `
        const {  } = form;
      `,
      errors: [
        {
          message: "remove getFieldDecorator",
          type: "Property",
        },
      ],
    },
    {
      code: `
const {  } = form;
      `,
      output: `

      `,
      errors: [
        {
          message: "remove empty form destrucutring",
          type: "VariableDeclaration",
        },
      ],
    },
    {
      code: `function f({}) {}`,
      output: `function f() {}`,
      errors: [
        {
          message: "remove empty pattern",
          type: "ObjectPattern",
        },
      ],
    },
  ],
});

module.exports = rule;
