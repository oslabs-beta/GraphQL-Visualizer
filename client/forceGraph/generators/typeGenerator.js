import { singular } from 'pluralize';
import {
  toCamelCase,
  toPascalCase,
  typeSet,
  getPrimaryKeyType,
} from './helperFunctions';

const TypeGenerator = {};

TypeGenerator.queries = function queries(tableName, tableData) {
  const { primaryKey, foreignKeys, columns } = tableData;
  const nameSingular = singular(tableName);
  const primaryKeyType = getPrimaryKeyType(primaryKey, columns);
  if (!foreignKeys || Object.keys(columns).length !== Object.keys(foreignKeys).length + 1) {
    // Do not output pure join tables
    let byID = toCamelCase(nameSingular);
    if (nameSingular === tableName) byID += 'ByID';
    return (
      `    ${toCamelCase(tableName)}: [${toPascalCase(nameSingular)}!]!\n` +
      `    ${byID}(${primaryKey}: ${primaryKeyType}!): ${toPascalCase(nameSingular)}!\n`
    );
  }
  return '';
};

TypeGenerator.mutations = function mutations(tableName, tableData) {
  const { primaryKey, foreignKeys, columns } = tableData;
  if (!foreignKeys || Object.keys(columns).length !== Object.keys(foreignKeys).length + 1) {
    // Do not output pure join tables
    return (
      this._create(tableName, primaryKey, foreignKeys, columns) +
      this._update(tableName, primaryKey, foreignKeys, columns) +
      this._destroy(tableName, primaryKey)
    );
  }
  return '';
};

TypeGenerator.customTypes = function customTypes(tableName, tables) {
  const { primaryKey, foreignKeys, columns } = tables[tableName];
  const primaryKeyType = getPrimaryKeyType(primaryKey, columns);
  if (foreignKeys === null || Object.keys(columns).length !== Object.keys(foreignKeys).length + 1) {
    return `${
      `  type ${toPascalCase(singular(tableName))} {\n` + `    ${primaryKey}: ${primaryKeyType}!`
    }${this._columns(primaryKey, foreignKeys, columns)}${this._getRelationships(
      tableName,
      tables
    )}\n  }\n\n`;
  }
  return '';
};

TypeGenerator._columns = function columns(primaryKey, foreignKeys, columns) {
  let colStr = '';
  for (const columnName in columns) {
    if (!(foreignKeys && foreignKeys[columnName]) && columnName !== primaryKey) {
      const { dataType, isNullable, columnDefault } = columns[columnName];
      colStr += `\n    ${columnName}: ${typeSet(dataType)}`;
      if (isNullable === 'NO' && columnDefault === null) colStr += '!';
    }
  }
  return colStr;
};

// Get table relationships
TypeGenerator._getRelationships = function getRelationships(tableName, tables) {
  let relationships = '';
  const alreadyAddedType = []; // cache to track which relation has been added or not
  for (const refTableName in tables[tableName].referencedBy) {
    const {
      referencedBy: foreignRefBy,
      foreignKeys: foreignFKeys,
      columns: foreignColumns,
    } = tables[refTableName];

    // One-to-one: when we can find tableName in foreignRefBy, that means this is a direct one to one relation
    if (foreignRefBy && foreignRefBy[tableName]) {
      if (!alreadyAddedType.includes(refTableName)) {
        // check if this refTableType has already been added by other tableName
        alreadyAddedType.push(refTableName);
        const refTableType = toPascalCase(singular(refTableName));
        relationships += `\n    ${toCamelCase(singular(reftableName))}: ${refTableType}`;
      }
    }

    // One-to-many: check if this is a join table, and if it's not, we can add relations)
    // example2: people table will meet this criteria
    // example3: species and people table will meet this criteria
    else if (Object.keys(foreignColumns).length !== Object.keys(foreignFKeys).length + 1) {
      if (!alreadyAddedType.includes(refTableName)) {
        // check if this refTableType has already been added by other tableName
        alreadyAddedType.push(refTableName);
        const refTableType = toPascalCase(singular(refTableName));
        relationships += `\n    ${toCamelCase(refTableName)}: [${refTableType}]`;
      }
    }

    // Many-to-many relations (so now handling join tables!)
    for (const foreignFKey in foreignFKeys) {

      if (tableName !== foreignFKeys[foreignFKey].referenceTable) {
        // Do not include original table in output
        if (!alreadyAddedType.includes(refTableName)) {
          // check if this refTableType has already been added by other tableName
          alreadyAddedType.push(refTableName);
          const manyToManyTable = toCamelCase(foreignFKeys[foreignFKey].referenceTable);

          relationships += `\n    ${manyToManyTable}: [${toPascalCase(singular(manyToManyTable))}]`;
        }
      }
    }
  }
  for (const FKTableName in tables[tableName].foreignKeys) {
    const object = tables[tableName].foreignKeys[FKTableName];
    const refTableName = object.referenceTable;
    const refTableType = toPascalCase(singular(refTableName));
    relationships += `\n    ${toCamelCase(refTableName)}: [${refTableType}]`;
  }

  return relationships;
};

TypeGenerator._create = function create(tableName, primaryKey, foreignKeys, columns) {
  return `\n    ${toCamelCase(`create_${singular(tableName)}`)}(\n${this._typeParams(
    primaryKey,
    foreignKeys,
    columns,
    false
  )}): ${toPascalCase(singular(tableName))}!\n`;
};

TypeGenerator._update = function update(tableName, primaryKey, foreignKeys, columns) {
  return `\n    ${toCamelCase(`update_${singular(tableName)}`)}(\n${this._typeParams(
    primaryKey,
    foreignKeys,
    columns,
    true
  )}): ${toPascalCase(singular(tableName))}!\n`;
};

TypeGenerator._destroy = function destroy(tableName, primaryKey) {
  return `\n    ${toCamelCase(`delete_${singular(tableName)}`)}(${primaryKey}: ID!): ${toPascalCase(
    singular(tableName)
  )}!\n`;
};

TypeGenerator._typeParams = function addParams(primaryKey, foreignKeys, columns, needId) {
  let typeDef = '';
  for (const columnName in columns) {
    const { dataType, isNullable } = columns[columnName];
      if (!needId && columnName === primaryKey) {
        // handle mutation on creating
        continue; // we don't need Id during creating, so skip this loop when columnName === primaryKey
      }

      if (needId && columnName === primaryKey) {
        // handle mutation on updating (will need Id)
        typeDef += `      ${columnName}: ${typeSet(dataType)}!,\n`; // automatically add '!,\n' (not null)
      } else {
        typeDef += `      ${columnName}: ${typeSet(dataType)}`;
        if (isNullable !== 'YES') typeDef += '!';
        typeDef += ',\n';
      }
    // }
  }
  if (typeDef !== '') typeDef += '    ';
  return typeDef;
};

export default TypeGenerator;

