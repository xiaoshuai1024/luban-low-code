import type { PageSchema } from '@luban-ui/luban-low-code';

/**
 * Default demo schema: layout + buttons + form, aligned with original demo page.
 */
export const defaultDemoSchema: PageSchema = {
  formState: {
    name: '',
    email: '',
    phone: '',
    channel: null as string | number | null,
    budget: null as number | null,
    notes: '',
    agree: false,
    subscribe: true,
  },
  root: {
    id: 'root',
    type: 'LubanContainer',
    props: { maxWidth: 'md', padded: true },
    children: [
      {
        id: 'main-row',
        type: 'LubanRow',
        props: { gap: 16 },
        children: [
          {
            id: 'col-left',
            type: 'LubanCol',
            props: { basis: 50 },
            children: [
              {
                id: 'layout-section',
                type: 'LubanRow',
                props: { gap: 12 },
                children: [
                  {
                    id: 'layout-card-1',
                    type: 'LubanCol',
                    props: {},
                    children: [
                      {
                        id: 'card-1',
                        type: 'LubanContainer',
                        props: { maxWidth: 'full', padded: true, 'data-cy': 'layout-card-1' },
                        children: [
                          {
                            id: 'card-1-btn',
                            type: 'LubanButton',
                            props: { variant: 'text', color: 'surface', content: '左侧内容' },
                            children: [],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    id: 'layout-card-2',
                    type: 'LubanCol',
                    props: {},
                    children: [
                      {
                        id: 'card-2',
                        type: 'LubanContainer',
                        props: { maxWidth: 'full', padded: true, 'data-cy': 'layout-card-2' },
                        children: [
                          {
                            id: 'card-2-btn',
                            type: 'LubanButton',
                            props: { variant: 'text', color: 'surface', content: '右侧内容' },
                            children: [],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                id: 'button-section',
                type: 'LubanRow',
                props: { gap: 12 },
                children: [
                  {
                    id: 'btn-primary',
                    type: 'LubanButton',
                    props: {
                      variant: 'contained',
                      color: 'primary',
                      'data-cy': 'primary-contained-btn',
                      content: '主按钮',
                    },
                    children: [],
                  },
                  {
                    id: 'btn-secondary',
                    type: 'LubanButton',
                    props: { variant: 'outlined', color: 'secondary', content: '次按钮' },
                    children: [],
                  },
                  {
                    id: 'btn-text',
                    type: 'LubanButton',
                    props: { variant: 'text', color: 'surface', content: '文本按钮' },
                    children: [],
                  },
                ],
              },
            ],
          },
          {
            id: 'col-right',
            type: 'LubanCol',
            props: { basis: 50 },
            children: [
              {
                id: 'form-section',
                type: 'LubanCol',
                props: {},
                children: [
                  {
                    id: 'input-name',
                    type: 'LubanInput',
                    props: { name: 'name', label: '姓名', placeholder: '请输入姓名' },
                    children: [],
                  },
                  {
                    id: 'input-email',
                    type: 'LubanInput',
                    props: {
                      name: 'email',
                      label: '邮箱',
                      type: 'email',
                      placeholder: 'name@example.com',
                    },
                    children: [],
                  },
                  {
                    id: 'input-phone',
                    type: 'LubanInput',
                    props: {
                      name: 'phone',
                      label: '手机号',
                      type: 'tel',
                      placeholder: '请输入手机号',
                    },
                    children: [],
                  },
                  {
                    id: 'select-channel',
                    type: 'LubanSelect',
                    props: {
                      name: 'channel',
                      label: '获客渠道',
                      placeholder: '请选择',
                      options: [
                        { label: '官网', value: 'web' },
                        { label: '广告投放', value: 'ads' },
                        { label: '线下活动', value: 'offline' },
                      ],
                    },
                    children: [],
                  },
                  {
                    id: 'radio-budget',
                    type: 'LubanRadioGroup',
                    props: {
                      name: 'budget',
                      label: '预算范围',
                      options: [
                        { label: '小于 1 万', value: 1 },
                        { label: '1-5 万', value: 5 },
                        { label: '大于 5 万', value: 10 },
                      ],
                    },
                    children: [],
                  },
                  {
                    id: 'textarea-notes',
                    type: 'LubanTextArea',
                    props: {
                      name: 'notes',
                      label: '需求说明',
                      placeholder: '请简要描述',
                      rows: 3,
                    },
                    children: [],
                  },
                  {
                    id: 'checkbox-agree',
                    type: 'LubanCheckbox',
                    props: { name: 'agree', label: '同意《隐私政策》' },
                    children: [],
                  },
                  {
                    id: 'switch-subscribe',
                    type: 'LubanSwitch',
                    props: { name: 'subscribe', label: '接收活动通知' },
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};
