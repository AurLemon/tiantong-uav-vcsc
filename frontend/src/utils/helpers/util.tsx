import * as lodash from 'lodash'
import { useNavigate, useParams } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { Button, Popconfirm, Tooltip, Descriptions, Modal } from 'antd'
import { EditOutlined, DeleteOutlined, EyeOutlined, CloseCircleTwoTone } from '@ant-design/icons'
import request from '@/utils/api/request'
import { addRule, authHeader, drawingList, removeRule, rule, updateRule } from '@/utils/api/api'
import { ModalForm, ProForm, ProFormText, ProFormSelect } from '@ant-design/pro-components'

export function getTableColumns(
  config,
  tableName,
  fields,
  setUpdateModalData,
  setViewModalData,
  tableRef,
  columnMetadata = {},
  navigateWithState = null
) {
  // console.log('config', config);
  // console.log('tableName', tableName);
  // console.log('fields', fields);

  const columnConfigs = config?.table?.columns ?? []
  const allColumn = config?.table?.all_columns ?? true
  const update_enable = config?.update?.enable ?? false
  const delete_enable = config?.delete?.enable ?? false
  const defaultOrderBy = config?.table?.order_by ?? {}

  let columns = []

  for (const [i, columnConfig] of columnConfigs.entries()) {
    // console.log('columnConfig', columnConfig);
    const field = columnConfig.field ?? null
    const relation = columnConfig.relation ?? null
    const width = columnConfig.width ?? null
    const inputType = columnConfig.input_type ?? null
    const title = columnConfig.title ?? lodash.startCase(field)
    const column = lodash.isEmpty(relation) ? fields[field] : fields[relation]
    let ofType = column.type?.name
    if (ofType === undefined) {
      ofType = column.type.ofType?.name
    }
    if (lodash.isEmpty(field)) {
      continue
    }
    const hideInView =
      config?.table?.hidden_columns.find((col) => {
        const field = columnConfig.field ?? null
        const relation = columnConfig.relation ?? null
        return col == relation || col == field
      }) ?? false
    const hideInCreate =
      config?.create?.hidden_columns.find((col) => {
        const field = columnConfig.field ?? null
        const relation = columnConfig.relation ?? null
        return col == relation || col == field
      }) ?? false
    const hideInUpdate =
      config?.update?.hidden_columns.find((col) => {
        const field = columnConfig.field ?? null
        const relation = columnConfig.relation ?? null
        return col == relation || col == field
      }) ?? false
    const hideInSearch =
      config?.filter?.hidden_columns.find((col) => {
        const field = columnConfig.field ?? null
        const relation = columnConfig.relation ?? null
        return col == relation || col == field
      }) ?? false
    const colFields = column.type?._fields ?? column.type?.ofType?._fields ?? undefined
    const columnValues = column.type._values ?? []
    let valueEnum = null
    let options = null
    if (ofType === 'Boolean') {
      valueEnum = {
        true: { text: 'TRUE' },
        false: { text: 'FALSE' },
      }
      options = [
        { label: 'TRUE', value: 'true' },
        { label: 'FALSE', value: 'false' },
      ]
    } else if (!lodash.isEmpty(columnValues)) {
      valueEnum = {}
      options = []
      for (const { name, value } of columnValues) {
        valueEnum[value] = { text: name }
        options.push({ label: name, value: value })
      }
    }
    const ellipsis = columnConfig.ellipsis ?? true
    columns.push({
      title: (
        <Tooltip placement='topLeft' title={title}>
          {title}
        </Tooltip>
      ),
      key: field,
      dataIndex: field,
      sorter: true,
      ofType: ofType,
      valueEnum: valueEnum,
      options: options,
      ellipsis: ellipsis
        ? {
            showTitle: false,
          }
        : false,
      showSorterTooltip: false,
      hideInTable: hideInView || field.toLowerCase().includes('password'),
      hideInSearch:
        hideInSearch ||
        hideInView ||
        field.toLowerCase().includes('password') ||
        colFields !== undefined,
      hideInUpdate: hideInUpdate || colFields !== undefined,
      hideInCreate: hideInCreate || colFields !== undefined,
      render: (_, record) => {
        let text = null
        if (record[field] && columnMetadata[field]?.type == 'datetime') {
          // 使用时间工具函数进行本地化处理
          const { formatBackendTime } = require('@/utils/time')
          text = formatBackendTime(record[field])
        } else if (column.type?.ofType?.name == 'Boolean') {
          text = record[field] ? 'TRUE' : 'FALSE'
          // } else if (!lodash.isEmpty(relation) && lodash.isObject(record[relation])) {
        } else if (colFields !== undefined) {
          text = record[relation]?.[field] ?? ''
        } else {
          text = record[field]
        }
        if (inputType == 'image') {
          return <img src={text} style={{ width: '100%' }} />
        } else if (ellipsis) {
          return (
            <Tooltip placement='topLeft' title={text}>
              {text}
            </Tooltip>
          )
        } else {
          return text
        }
      },
      valueType: columnMetadata[field]?.type == 'datetime' ? 'dateRange' : null,
      colOrder: Number.MAX_SAFE_INTEGER - 1 - i,
      width: columnMetadata[field]?.type == 'datetime' ? 170 : field == 'id' ? 70 : width,
    })
  }

  for (const [_, data] of Object.entries(fields)) {
    const foundInColumnConfig = columnConfigs.find((columnConfig) => {
      const field = columnConfig.field ?? null
      const relation = columnConfig.relation ?? null
      return (data as any).name == relation || (data as any).name == field
    })
    if (foundInColumnConfig) {
      continue
    }
    let name = (data as any).name
    // console.log('column', column);
    // console.log('column.type.ofType', column.type.ofType);
    const colFields = (data as any).type?._fields ?? (data as any).type?.ofType?._fields ?? undefined
     let ofType = (data as any).type?.name
     if (ofType === undefined) {
       ofType = (data as any).type.ofType?.name
     }
    const hideInView =
      config?.table?.hidden_columns.find((col) => {
        return (data as any).name == col
      }) ??
      (false || allColumn == false)
    const hideInCreate =
      config?.create?.hidden_columns.find((col) => {
        return (data as any).name == col
      }) ?? false
    const hideInUpdate =
      config?.update?.hidden_columns.find((col) => {
        return (data as any).name == col
      }) ?? false
    const hideInSearch =
      config?.filter?.hidden_columns.find((col) => {
        return (data as any).name == col
      }) ??
      (false || allColumn == false)
    const columnValues = (data as any).type._values ?? []
    let valueEnum = null
    let options = null
    if (ofType === 'Boolean') {
      valueEnum = {
        true: { text: 'TRUE' },
        false: { text: 'FALSE' },
      }
      options = [
        { label: 'TRUE', value: true },
        { label: 'FALSE', value: false },
      ]
    } else if (!lodash.isEmpty(columnValues)) {
      valueEnum = {}
      options = []
      for (const { name, value } of columnValues) {
        valueEnum[value] = { text: name }
        options.push({ label: name, value: value })
      }
    }
    const ellipsis = true
    if (colFields !== undefined) {
      continue
    }
    columns.push({
      title: (
        <Tooltip placement='topLeft' title={lodash.startCase(name)}>
          {lodash.startCase(name)}
        </Tooltip>
      ),
      key: name,
      dataIndex: name,
      sorter: true,
      ofType: ofType,
      valueEnum: valueEnum,
      options: options,
      ellipsis: ellipsis
        ? {
            showTitle: false,
          }
        : false,
      showSorterTooltip: false,
      hideInTable:
        hideInView || (data as any).name.toLowerCase().includes('password') || colFields !== undefined,
      hideInSearch:
        hideInSearch ||
        hideInView ||
        (data as any).name.toLowerCase().includes('password') ||
        colFields !== undefined,
      hideInUpdate: hideInUpdate || colFields !== undefined,
      hideInCreate: hideInCreate || colFields !== undefined,
      render: (_, record) => {
        let text = null
        if (record[name] && columnMetadata[name]?.type == 'datetime') {
          // 使用时间工具函数进行本地化处理
          const { formatBackendTime } = require('@/utils/time')
          text = formatBackendTime(record[name])
        } else if ((data as any).type?.ofType?.name == 'Boolean') {
          text = record[name] ? 'TRUE' : 'FALSE'
        } else {
          text = record[name]
        }
        if (ellipsis) {
          return (
            <Tooltip placement='topLeft' title={text}>
              {text}
            </Tooltip>
          )
        } else {
          return text
        }
      },
      valueType: columnMetadata[name]?.type == 'datetime' ? 'dateRange' : null,
      colOrder:
        columnMetadata[name]?.type == 'datetime'
          ? Number.MIN_SAFE_INTEGER
          : name == 'id'
            ? Number.MAX_SAFE_INTEGER
            : null,
      width: columnMetadata[name]?.type == 'datetime' ? 170 : name == 'id' ? 70 : null,
    })
  }

  columns.push({
    title: '',
    width: 40 + (update_enable ? 34 : 0) + (delete_enable ? 34 : 0),
    hideInUpdate: true,
    hideInCreate: true,
    hideInModalView: true,
    valueType: 'option',
    key: '_option_',
    render: (text, record, _, action) => [
      config?.editor?.enable && navigateWithState ? (
        <Button
          icon={<EyeOutlined />}
          size='small'
          onClick={() => {
            const paths = window.location.pathname.split('/')
            const table_name = paths[paths.length - 1]
            const table_type = paths[paths.length - 2]
            const child_name = config?.childNavBar ? `/${tableName}` : ''
            navigateWithState(`/admin/${table_type}/${table_name}${child_name}/view`, {
              config,
              tableName,
              record,
            })
          }}
        />
      ) : (
        <Button icon={<EyeOutlined />} size='small' onClick={() => setViewModalData(record)} />
      ),

      update_enable && config?.editor?.enable && navigateWithState ? (
        <Button
          icon={<EditOutlined />}
          size='small'
          onClick={() => {
            const paths = window.location.pathname.split('/')
            const table_name = paths[paths.length - 1]
            const table_type = paths[paths.length - 2]
            const child_name = config?.childNavBar ? `/${tableName}` : ''
            navigateWithState(`/admin/${table_type}/${table_name}${child_name}/update`, {
              config,
              tableName,
              record,
            })
          }}
        />
      ) : update_enable ? (
        <Button icon={<EditOutlined />} size='small' onClick={() => setUpdateModalData(record)} />
      ) : null,

      delete_enable ? (
        <Popconfirm
          key='delete'
          title='Delete?'
          onConfirm={async () => {
            const entityMetadata = await getEntityMetadata(tableName)
            const primaryKeys = entityMetadata.primary_key ?? []
            let filters = []
            for (const primaryKey of primaryKeys) {
              const column = fields[primaryKey]
              let ofType = column.type?.name
              if (ofType === undefined) {
                ofType = column.type.ofType?.name
              }
              if (ofType === 'Int' || ofType === 'Float' || ofType === 'Boolean') {
                filters.push(`${primaryKey}: { eq: ${record[primaryKey]} }`)
              } else {
                filters.push(`${primaryKey}: { eq: "${record[primaryKey]}" }`)
              }
            }
            const res = await request(`/graphql`, {
              method: 'POST',
              headers: authHeader(),
              data: {
                query: `
                  mutation {
                    ${tableName}_delete(
                      filter: {
                        ${filters.join('\n')}
                      }
                    )
                  }
                `,
                variable: {},
              },
            })
            // console.log('res', res);
            if (lodash.isEmpty((res as any)?.errors)) {
              tableRef.current?.reload()
              return true
            } else {
              return false
            }
          }}
        >
          <Button icon={<DeleteOutlined />} size='small' />
        </Popconfirm>
      ) : null,
    ],
  })

  for (let column of columns) {
    let fieldOrder = null
    const fieldConfig =
      config?.editor?.fields.find((col, idx) => {
        const field = column.key ?? null
        const found = col.field == field
        if (found) {
          fieldOrder = Number.MAX_SAFE_INTEGER - 1 - idx
        }
        return found
      }) ?? {}
    column['fieldOrder'] = fieldOrder
    column['fieldConfig'] = fieldConfig
  }

  // console.log('columns_1', columns);

  columns.sort((a, b) => b.colOrder - a.colOrder)

  // console.log('columns_2', columns);

  return columns
}

export async function getTableRequest(
  params,
  sort,
  filter,
  config,
  tableName,
  fields,
  tableFilter,
  childrenConfig = [],
  columnMetadata = {}
) {
  const columnConfigs = config?.table?.columns ?? []
  const allColumn = config?.table?.all_columns ?? true
  const defaultOrderBy = config?.table?.order_by ?? {}
  const children = config?.children ?? childrenConfig

  // console.log('params', params);
  // console.log('sort', sort);
  // console.log('filter', filter);

  let columns = []

  for (const columnConfig of columnConfigs) {
    // console.log('columnConfig', columnConfig);
    const field = columnConfig.field ?? null
    const relation = columnConfig.relation ?? null
    if (lodash.isEmpty(field)) {
      continue
    }
    if (lodash.isEmpty(relation)) {
      columns.push(field)
    } else {
      columns.push(`${relation} { ${field} }`)
    }
  }

  for (const [_, data] of Object.entries(fields)) {
    const foundInColumnConfig = columnConfigs.find((columnConfig) => {
      const field = columnConfig.field ?? null
      const relation = columnConfig.relation ?? null
      return (data as any).name == relation || (data as any).name == field
    })
    if (foundInColumnConfig) {
      continue
    }
    // console.log('data', data);
    const colFields = (data as any).type?._fields ?? (data as any).type?.ofType?._fields ?? undefined
    if (colFields === undefined) {
      columns.push((data as any).name)
    }
  }

  for (const child of children) {
    const relation = child.relation ?? ''
    const childColumnConfigs = child.table?.columns ?? []
    const childAllColumn = child.table?.all_columns ?? true
    const childFields =
      fields[relation].type.ofType?.getFields().nodes.type.ofType.ofType.ofType.getFields() ??
      fields[relation].type.getFields()

    let cols = []

    for (const columnConfig of childColumnConfigs) {
      // console.log('columnConfig', columnConfig);
      const field = columnConfig.field ?? null
      const relation = columnConfig.relation ?? null
      if (lodash.isEmpty(field)) {
        continue
      }
      if (lodash.isEmpty(relation)) {
        cols.push(field)
      } else {
        cols.push(`${relation} { ${field} }`)
      }
    }

    for (const [_, data] of Object.entries(childFields)) {
      const foundInColumnConfig = childColumnConfigs.find((columnConfig) => {
        const field = columnConfig.field ?? null
        const relation = columnConfig.relation ?? null
        return (data as any).name == relation || (data as any).name == field
      })
      if (foundInColumnConfig) {
        continue
      }
      // console.log('data', data);
      const colFields = (data as any).type?._fields ?? (data as any).type?.ofType?._fields ?? undefined
      if (colFields === undefined) {
        cols.push((data as any).name)
      }
    }

    if (lodash.isEmpty(fields[relation].type.ofType?.getFields())) {
      columns.push(`${relation} { ${cols.join(', ')} }`)
    } else {
      columns.push(`${relation} { nodes { ${cols.join(', ')} } }`)
    }
  }

  let filters = []
  for (const col of columns) {
    if (params[col] === undefined || params[col].length <= 0) {
      continue
    }
    const filterField = tableFilter.type.getFields()[col]
    const filterFieldOps = filterField.type.getFields()
    const eqOps = Object.values(filterFieldOps).find((row) => (row as any).name == 'eq')
    const containsOps = Object.values(filterFieldOps).find((row) => (row as any).name == 'contains')
    // console.log('filters_2', col);
    // console.log('filters_1', table);
    // console.log('filters_3', table.args);
    // console.log('filters_4', tableFilter);
    // console.log('filters_5', filterField);
    // console.log('filters_6', filterFieldOps);
    if (containsOps !== undefined) {
      filters.push(`${col}: { contains: "${params[col]}" }`)
    } else {
      // console.log('eqOps', eqOps);
      if (columnMetadata[col]?.type == 'datetime') {
        filters.push(
          `${col}: { between: ["${params[col][0]} 00:00:00", "${params[col][1]} 23:59:59"] }`
        )
      } else if ((eqOps as any).type.name == 'Int') {
        filters.push(`${col}: { eq: ${params[col]} }`)
      } else if ((eqOps as any).type.name == 'Boolean') {
        filters.push(`${col}: { eq: ${params[col]} }`)
      } else {
        filters.push(`${col}: { eq: "${params[col]}" }`)
      }
    }
  }

  let orderBy = []
  for (const [key, order] of Object.entries(sort)) {
    orderBy.push(`${key}: ${order == 'ascend' ? 'ASC' : 'DESC'}`)
  }
  if (orderBy.length == 0 && !lodash.isEmpty(defaultOrderBy)) {
    orderBy.push(`${defaultOrderBy.field}: ${defaultOrderBy.order.toUpperCase()}`)
  }

  const res = await request(`/graphql`, {
    method: 'POST',
    headers: authHeader(),
    data: {
      query: `
        query {
          ${tableName}(
            filters: { ${filters.join(', ')} }
            order_by: { ${orderBy.join(', ')} }
            pagination: { page: { limit: ${params?.pageSize ?? 10}, page: ${(params?.current ?? 1) - 1} } }
          ) {
            nodes {
              ${columns.join(', ')}
            }
            pagination_info {
              current
              pages
              offset
              total
            }
          }
        }
      `,
      variables: {},
    },
  })
  const data = {
    success: true,
    data: res.data[tableName].nodes.map((row) => {
      row['_uuid_v4_'] = uuidv4()
      return row
    }),
    total: res.data[tableName].pagination_info.total,
  }
  // console.log('data', data);
  return data
}

export function getFormUpdate(
  config,
  tableName,
  fields,
  modalData,
  setModalData,
  formEditRef,
  tableRef,
  primaryKeys = []
) {
  const update_enable = config?.update?.enable ?? false

  if (!update_enable) {
    return
  }

  const tableColumns = getTableColumns(
    config,
    tableName,
    fields,
    setModalData,
    null,
    tableRef,
    {},
    null
  )

  // return getProLicenseModal(modalData, setModalData);

  return (
    <ModalForm
      title='Edit'
      open={modalData !== undefined}
      onFinish={async () => {
        let data = []
        let filters = []
        for (const [key, val] of Object.entries(formEditRef?.current?.getFieldsValue())) {
          const column = fields[key]
          let ofType = column.type?.name
          if (ofType === undefined) {
            ofType = column.type.ofType?.name
          }
          if (primaryKeys.includes(key)) {
            if (ofType === 'Int' || ofType === 'Float' || ofType === 'Boolean') {
              filters.push(`${key}: { eq: ${val} }`)
            } else {
              filters.push(`${key}: { eq: "${val}" }`)
            }
          }
          if (modalData[key] === val) {
            continue
          }
          if (val !== true && val !== false && lodash.isEmpty(val)) {
            data.push(`${key}: null`)
            continue
          }
          if (ofType == 'Boolean') {
            data.push(`${key}: ${JSON.stringify(val)}`)
          } else if (ofType == 'Int' || ofType == 'Float') {
            data.push(`${key}: ${val}`)
          } else if (val && (key == 'created_at' || key == 'updated_at' || key == 'created_date')) {
            data.push(`${key}: ${JSON.stringify(String(val).split('.')[0])}`)
          } else {
            data.push(`${key}: ${JSON.stringify(val)}`)
          }
        }

        const res = await request(`/graphql`, {
          method: 'POST',
          headers: authHeader(),
          data: {
            query: `
              mutation {
                ${tableName}_update(
                  data: {
                    ${data.join(', ')}
                  }
                  filter: {
                    ${filters.join('\n')}
                  }
                ) {
                  ${primaryKeys.join(', ')}
                }
              }
            `,
            variable: {},
          },
        })
        // console.log('res', res);
        if (lodash.isEmpty((res as any)?.errors)) {
          tableRef.current?.reload()
          return true
        } else {
          return false
        }
      }}
      onOpenChange={(visible) => {
        if (visible) {
          formEditRef?.current?.setFieldsValue(modalData)
          // console.log('formEditRef?.current?.getFieldsValue()', formEditRef?.current?.getFieldsValue());
        } else {
          setModalData(undefined)
        }
      }}
      formRef={formEditRef}
    >
      <ProForm.Group>
        {tableColumns
          .filter((col) => {
            return !col.hideInUpdate
          })
          .map((col) => {
            if (lodash.isEmpty(col.options)) {
              return (
                <ProFormText
                  width='md'
                  key={col.dataIndex}
                  disabled={primaryKeys.includes(col.dataIndex)}
                  name={col.dataIndex}
                  label={col.title}
                  placeholder=''
                />
              )
            } else {
              return (
                <ProFormSelect
                  width='md'
                  key={col.dataIndex}
                  disabled={primaryKeys.includes(col.dataIndex)}
                  name={col.dataIndex}
                  label={col.title}
                  options={col.options}
                />
              )
            }
          })}
      </ProForm.Group>
    </ModalForm>
  )
}

export function getFormCreate(
  config,
  tableName,
  fields,
  formNewOpen,
  setFormNewOpen,
  formNewRef,
  tableRef
) {
  const create_enable = config?.create?.enable ?? false

  if (!create_enable) {
    return
  }

  const tableColumns = getTableColumns(config, tableName, fields, null, null, tableRef, {}, null)

  // return getProLicenseModal(formNewOpen, setFormNewOpen);

  return (
    <ModalForm
      title='New'
      open={formNewOpen}
      onFinish={async () => {
        let data = []
        const entityMetadata = await getEntityMetadata(tableName)
        const primaryKeys = entityMetadata.primary_key ?? []
        for (const [key, val] of Object.entries(formNewRef?.current?.getFieldsValue())) {
          const column = fields[key]
          let ofType = column.type?.name
          if (ofType === undefined) {
            ofType = column.type.ofType?.name
          }
          if (val !== true && val !== false && lodash.isEmpty(val)) {
            data.push(`${key}: null`)
            continue
          }
          if (ofType == 'Boolean') {
            data.push(`${key}: ${val}`)
          } else if (ofType == 'Int' || ofType == 'Float') {
            data.push(`${key}: ${val}`)
          } else if (val && (key == 'created_at' || key == 'updated_at' || key == 'created_date')) {
            data.push(`${key}: ${JSON.stringify(String(val).split('.')[0])}`)
          } else {
            data.push(`${key}: ${JSON.stringify(val)}`)
          }
        }

        const res = await request(`/graphql`, {
          method: 'POST',
          headers: authHeader(),
          data: {
            query: `
              mutation {
                ${tableName}_create_one(
                  data: {
                    ${data.join(', ')}
                  }
                ) {
                  ${primaryKeys.join(', ')}
                }
              }
            `,
            variable: {},
          },
        })
        // console.log('res', res);
        if (lodash.isEmpty((res as any)?.errors)) {
          tableRef.current?.reload()
          return true
        } else {
          return false
        }
      }}
      onOpenChange={setFormNewOpen}
      formRef={formNewRef}
    >
      <ProForm.Group>
        {tableColumns
          .filter((col) => {
            return !col.hideInCreate
          })
          .map((col) => {
            return (
              <ProFormText
                width='md'
                key={col.dataIndex}
                name={col.dataIndex}
                label={col.title}
                placeholder=''
              />
            )
          })}
      </ProForm.Group>
    </ModalForm>
  )
}

export function getModalView(config, tableName, fields, viewModalData, setViewModalData, modalRef) {
  const tableColumns = getTableColumns(config, tableName, fields, null, null, modalRef, {}, null)

  return (
    <ModalForm
      title='View'
      open={viewModalData !== undefined}
      onOpenChange={(visible) => {
        if (visible) {
        } else {
          setViewModalData(undefined)
        }
      }}
      formRef={modalRef}
      modalProps={{ footer: null }}
      submitter={{
        resetButtonProps: {
          style: {
            display: 'none',
          },
        },
        submitButtonProps: {
          style: {
            display: 'none',
          },
        },
      }}
    >
      <Descriptions column={{ xxl: 2, xl: 2, lg: 2, md: 2, sm: 2, xs: 1 }} size='small' bordered>
        {tableColumns
          .filter((col) => {
            return !col.hideInModalView && !col.hideInTable
          })
          .map((col) => {
            return viewModalData ? (
              <Descriptions.Item label={col.title}>
                {col.render && col.render(null as any, viewModalData, 0, null as any)}
              </Descriptions.Item>
            ) : null
          })}
      </Descriptions>
    </ModalForm>
  )
}

export function getProLicenseModal(modalOpen, setModalOpen) {
  return (
    <Modal open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
      <h2 style={{ textAlign: 'center', margin: 64 }}>
        <CloseCircleTwoTone twoToneColor='#FF0000' style={{ fontSize: 32 }} />
        <br />
        Pro License Required
      </h2>
    </Modal>
  )
}

export async function getEntityMetadata(tableName) {
  const res = await request(`/graphql`, {
    method: 'POST',
    headers: authHeader(),
    data: {
      query: `
        query {
          _sea_orm_entity_metadata(table_name: "${tableName}")
        }
      `,
      variable: {},
    },
  })
  let entityMetadata = res?.data?._sea_orm_entity_metadata ?? {}
  entityMetadata.cols = {}
  for (const col of entityMetadata?.columns ?? []) {
    entityMetadata.cols[col.name] = col
  }
  return entityMetadata
}
