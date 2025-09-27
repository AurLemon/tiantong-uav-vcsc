import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { addRule, authHeader, drawingList, removeRule, rule, updateRule } from '@/utils/api/api'
import type {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormInstance,
} from '@ant-design/pro-components'
import {
  FooterToolbar,
  ModalForm,
  PageContainer,
  ProDescriptions,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components'
import { useParams } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { useNavigateWithState } from '@/hooks/ui/useNavigateWithState'
import { useModel } from '@/contexts/global/GlobalContext'
import { request } from '@/utils/api/request'
import { useLocation } from 'react-router-dom'
import { Button, Drawer, Input, Form, message, Popconfirm, Descriptions, Modal } from 'antd'
import React, { useEffect, useRef, useState } from 'react'
import { ProCard } from '@ant-design/pro-components'
import { buildClientSchema, getIntrospectionQuery, GraphQLSchema } from 'graphql'
import * as lodash from 'lodash'
import {
  DrawerForm,
  ProForm,
  ProFormDateRangePicker,
  ProFormSelect,
} from '@ant-design/pro-components'
import {
  getTableColumns,
  getTableRequest,
  getFormUpdate,
  getFormCreate,
  getModalView,
  getEntityMetadata,
} from '../../utils/helpers/util'
import { v4 as uuidv4 } from 'uuid'

interface TableListProps {
  breadcrumbTitle?: string;
  editMode?: string;
}

const TableList: React.FC<TableListProps> = ({ breadcrumbTitle, editMode }) => {
  const navigate = useNavigate()
  const navigateWithState = useNavigateWithState()
  const { initialState } = useModel('@@initialState')
  const tableRef = useRef<ActionType>()
  const formRef = useRef<ProFormInstance>()
  const pageParams = useParams()
  const [query, setQuery] = useState({})
  const [primaryKeys, setPrimaryKeys] = useState([])
  const [columnMetadata, setColumnMetadata] = useState({})
  const [tableColumns, setTableColumns] = useState([])
  const [formNewOpen, setFormNewOpen] = useState(false)
  const [modalData, setModalData] = useState()
  const [form] = Form.useForm<{ name: string; company: string }>()
  const location = useLocation()
  const [searchParams, setSearchParams] = useState(new URLSearchParams(location.search))

  const [viewModalData, setViewModalData] = useState()
  const viewModalRef = useRef<ProFormInstance>()

  const tableName = location.state?.tableName
  const config = location.state?.config

  const create_enable = config?.create?.enable ?? false
  const defaultPageSize = config?.table?.page_size ?? 20
  const defaultTableSize = config?.table?.table_size ?? 'middle'
  const update_enable = config?.update?.enable ?? false

  useEffect(() => {
    const genData = async () => {
      const entityMetadata = await getEntityMetadata(tableName)
      const primaryKeys = entityMetadata.primary_key ?? []
      setPrimaryKeys(primaryKeys)
      setColumnMetadata(entityMetadata.cols)

      return await request(`/graphql`, {
        method: 'POST',
        headers: authHeader(),
        data: {
          query: getIntrospectionQuery(),
          variables: {},
        },
      })
    }
    genData().then((raw_data) => {
      const schema = buildClientSchema(raw_data.data)
      const query = schema.getQueryType().getFields()
      setQuery(query)
    })
  }, [])

  useEffect(() => {
    if (lodash.isEmpty(query)) {
      return
    }

    const fields = (query as any)[tableName].type.ofType
      .getFields()
      .nodes.type.ofType.ofType.ofType.getFields()

    const columns = getTableColumns(
      config,
      tableName,
      fields,
      setModalData,
      setViewModalData,
      tableRef,
      columnMetadata,
      navigateWithState
    )

    columns.sort((a, b) => b.fieldOrder - a.fieldOrder)

    setTableColumns(columns)

    tableRef.current?.reloadAndRest()
  }, [query])

  async function refreshData() {
    const genData = async () => {
      const fields = (query as any)[tableName].type.ofType
        .getFields()
        .nodes.type.ofType.ofType.ofType.getFields()
      const tableFilter = Object.values((query as any)[tableName].args).find((arg: any) => arg.name == 'filters')
      const params = location.state?.record

      let filters = []
      let columns = []

      if (!params) {
        return
      }

      for (const col of primaryKeys) {
        if (params[col] === undefined || params[col].length <= 0) {
          continue
        }
        const filterField = (tableFilter as any).type.getFields()[col]
        const filterFieldOps = filterField.type.getFields()
        const eqOps = Object.values(filterFieldOps).find((row: any) => row.name == 'eq')
        const containsOps = Object.values(filterFieldOps).find((row: any) => row.name == 'contains')
        if (containsOps !== undefined) {
          filters.push(`${col}: { contains: "${params[col]}" }`)
        } else {
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

      for (const col in params) {
        if (col == '_uuid_v4_') {
          continue
        }
        const colFields =
          (fields as any)[col].type?._fields ?? (fields as any)[col].type?.ofType?._fields ?? undefined
        if (colFields === undefined) {
          columns.push(col)
        }
      }

      return await request(`/graphql`, {
        method: 'POST',
        headers: authHeader(),
        data: {
          query: `
            query {
              ${tableName}(
                filters: { ${filters.join(', ')} }
              ) {
                nodes {
                  ${columns.join(', ')}
                }
              }
            }
          `,
          variables: {},
        },
      })
    }
    if (lodash.isEmpty(query)) {
      formRef?.current?.setFieldsValue(location.state?.record)
      setModalData(location.state?.record)
      return
    }
    genData().then((res) => {
      const nodes = res?.data?.[tableName]?.nodes ?? []
      if (nodes.length > 0) {
        formRef?.current?.setFieldsValue(nodes[0])
        setModalData(nodes[0])
      }
    })
  }

  useEffect(() => {
    refreshData()
  }, [query])

  const [fieldTitle, setFieldTitle] = useState('')

  useEffect(() => {
    let fieldTitle = ''
    const fieldTitleKey = config?.editor?.title_field ?? null
    if (fieldTitleKey && formRef?.current?.getFieldsValue()[fieldTitleKey]) {
      setFieldTitle(formRef?.current?.getFieldsValue()[fieldTitleKey])
    }
  }, [formRef?.current?.getFieldsValue()])

  const paths = window.location.pathname.split('/')
  const table_name = pageParams?.childTable ? paths[paths.length - 3] : paths[paths.length - 2]
  const table_type = pageParams?.childTable ? paths[paths.length - 4] : paths[paths.length - 3]
  const child_name = config?.childNavBar ? `/${tableName}` : ''

  return (
    <PageContainer
      header={{
        title: null,
        breadcrumb: {
          items: [
            {
              href: '#',
              title: table_type == 'table' ? 'Raw Tables' : 'Composite Tables',
              onClick: () => navigate(`/${table_type}`),
            },
            {
              href: '#',
              title: config?.table?.title ?? lodash.startCase(pageParams.table),
              onClick: () => navigate(`/${table_type}/${table_name}`),
            },
            pageParams?.childTable
              ? {
                  href: '#',
                  title: lodash.startCase(pageParams?.childTable),
                  onClick: () => navigate(`/${table_type}/${table_name}`),
                }
              : {},
            {
              title: breadcrumbTitle,
            },
          ],
        },
      }}
    >
      <ProCard
        title={
          (config?.table?.title ?? lodash.startCase(pageParams.table)) +
          (fieldTitle ? `: ${fieldTitle}` : '')
        }
      >
        <ProForm
          layout={'vertical'}
          grid={true}
          rowProps={{ gutter: 1 }}
          formRef={formRef}
          submitter={
            editMode == 'READONLY'
              ? {
                  resetButtonProps: { style: { display: 'none' } },
                  submitButtonProps: { style: { display: 'none' } },
                  render: (props, doms) => {
                    return [
                      ...doms,
                      update_enable ? (
                        <Button
                          onClick={() => {
                            navigate(`/admin/${table_type}/${table_name}${child_name}/update`, {
                              state: {
                                config,
                                tableName,
                                record: modalData,
                              },
                            })
                          }}
                        >
                          Update
                        </Button>
                      ) : null,
                    ]
                  },
                }
              : {
                  resetButtonProps: { style: { display: 'none' } },
                }
          }
          onFinish={
            editMode == 'UPDATE'
              ? async () => {
                  let data = []
                  let filters = []
                  const fields = (query as any)[tableName].type.ofType
                    .getFields()
                    .nodes.type.ofType.ofType.ofType.getFields()
                  for (const [key, val] of Object.entries(formRef?.current?.getFieldsValue())) {
                    const column = (fields as any)[key]
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
                    if ((modalData as any)[key] === val) {
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
                    } else if (
                      val &&
                      (key == 'created_at' || key == 'updated_at' || key == 'created_date')
                    ) {
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
                  if (lodash.isEmpty((res as any)?.errors)) {
                    refreshData()
                    const paths = window.location.pathname.split('/')
                    navigate(`/admin/${table_type}/${table_name}${child_name}/view`, {
                      state: {
                        config,
                        tableName,
                        record: modalData,
                      },
                    })
                  }
                }
              : editMode == 'CREATE'
                ? async () => {
                    let data = []
                    const fields = (query as any)[tableName].type.ofType
                      .getFields()
                      .nodes.type.ofType.ofType.ofType.getFields()
                    for (const [key, val] of Object.entries(formRef?.current?.getFieldsValue())) {
                      const column = (fields as any)[key]
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
                      } else if (
                        val &&
                        (key == 'created_at' || key == 'updated_at' || key == 'created_date')
                      ) {
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
                      const row = res?.data?.[`${tableName}_create_one`] ?? {}
                      for (const key in row) {
                        formRef?.current?.setFieldValue(key, row[key])
                      }
                      refreshData()
                      const paths = window.location.pathname.split('/')
                      navigate(`/admin/${table_type}/${table_name}${child_name}/view`, {
                        state: {
                          config,
                          tableName,
                          record: formRef?.current?.getFieldsValue(),
                        },
                      })
                    }
                  }
                : () => {}
          }
        >
          <ProForm.Group>
            {tableColumns
              .filter((col) => {
                return !col.hideInUpdate
              })
              .map((col) => {
                if (lodash.isEmpty(col.options)) {
                  if (col.fieldConfig?.input_type == 'textarea') {
                    return (
                      <ProFormTextArea
                        colProps={{ span: col.fieldConfig?.span ?? 8 }}
                        fieldProps={{ rows: col.fieldConfig?.rows ?? 3 }}
                        key={col.dataIndex}
                        name={col.dataIndex}
                        label={col.fieldConfig?.title ?? col.title}
                        placeholder=''
                        disabled={
                          editMode == 'READONLY' ||
                          (editMode == 'UPDATE' && primaryKeys.includes(col.dataIndex))
                        }
                      />
                    )
                  } else {
                    return (
                      <ProFormText
                        colProps={{ span: col.fieldConfig?.span ?? 8 }}
                        key={col.dataIndex}
                        name={col.dataIndex}
                        label={col.fieldConfig?.title ?? col.title}
                        placeholder=''
                        disabled={
                          editMode == 'READONLY' ||
                          (editMode == 'UPDATE' && primaryKeys.includes(col.dataIndex))
                        }
                      />
                    )
                  }
                } else {
                  return (
                    <ProFormSelect
                      colProps={{ span: col.fieldConfig?.span ?? 8 }}
                      key={col.dataIndex}
                      name={col.dataIndex}
                      label={col.fieldConfig?.title ?? col.title}
                      options={col.options}
                      disabled={
                        editMode == 'READONLY' ||
                        (editMode == 'UPDATE' && primaryKeys.includes(col.dataIndex))
                      }
                    />
                  )
                }
              })}
          </ProForm.Group>
        </ProForm>
      </ProCard>
    </PageContainer>
  )
}

export default TableList
