import Ajv from "ajv"
const ajv = new Ajv({ schemaId: 'auto', $data: true, allErrors: true });

export const body = function (JSchema) {
  return (req, res, next) => {
    const body = req.body;
    const valid = ajv.validate(JSchema, body);
    if (valid)
      next();
    else
      res.status(400).send({
        Success: false, Error: {
          code: "BAD_INPUT",
          _detail: ajv.errors
        }
      });
  };
};

export const param = function (JSchema) {
  return (req, res, next) => {
    const query = req.params;
    const valid = ajv.validate(JSchema, query);
    if (valid)
      next();
    else
      res.status(400).send({
        Success: false, Error: {
          code: "BAD_INPUT",
          _detail: ajv.errors
        }
      });
  };
};

