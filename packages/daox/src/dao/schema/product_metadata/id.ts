export default {
  business_rules: [],
  enum_values: { value: [] },
  format: {
    message: "schema.format.message",
    value: ""
  },
  has_default: { value: false },
  is_auto_increment: { value: false },
  is_generated: { value: false },
  is_index: { value: false },
  is_optional: {
    message: "schema.is_optional.message",
    value: false
  },
  is_primary_key: { value: true },
  is_unique: { value: false },
  max_length: {
    message: "schema.max_length.message|255",
    value: 255
  },
  max_value: {
    message: "schema.max_value.message|9007199254740991",
    value: 9007199254740991
  },
  min_length: {
    message: "schema.min_length.message|1",
    value: 1
  },
  min_value: {
    message: "schema.min_value.message|0",
    value: 0
  },
  type: {
    message: "schema.type.message",
    value: "Buffer"
  }
};
