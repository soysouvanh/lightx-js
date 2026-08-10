export default {
  business_rules: [],
  enum_values: { value: [] },
  format: {
    value: "",
    message: "schema.format.message"
  },
  has_default: { value: true },
  is_auto_increment: { value: false },
  is_generated: { value: false },
  is_index: { value: false },
  is_optional: {
    value: false,
    message: "schema.is_optional.message"
  },
  is_primary_key: { value: false },
  is_unique: { value: false },
  max_length: {
    value: 255,
    message: "schema.max_length.message|255"
  },
  max_value: {
    value: 9007199254740991,
    message: "schema.max_value.message|9223372036854775807"
  },
  min_length: {
    value: 1,
    message: "schema.min_length.message|1"
  },
  min_value: {
    value: 0,
    message: "schema.min_value.message|0"
  },
  type: {
    value: "number",
    message: "schema.type.message"
  }
};
