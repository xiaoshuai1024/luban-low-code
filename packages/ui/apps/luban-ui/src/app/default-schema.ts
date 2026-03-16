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
        id: 'banner-row',
        type: 'LubanRow',
        props: { gap: 0 },
        children: [
          {
            id: 'banner-col',
            type: 'LubanCol',
            props: { basis: 100 },
            children: [
              {
                id: 'banner',
                type: 'LubanBanner',
                props: {
                  src: 'https://picsum.photos/960/240',
                  alt: '活动 Banner',
                  height: 240,
                  objectFit: 'cover',
                },
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'title-row',
        type: 'LubanRow',
        props: { gap: 0 },
        children: [
          {
            id: 'title-col',
            type: 'LubanCol',
            props: { basis: 100 },
            children: [
              {
                id: 'title-text',
                type: 'LubanText',
                props: { tag: 'h1', variant: 'h1', content: '欢迎留下联系方式' },
                children: [],
              },
              {
                id: 'subtitle-text',
                type: 'LubanText',
                props: { variant: 'body2', secondary: true, content: '填写下方表单，我们会尽快与您联系。' },
                children: [],
              },
            ],
          },
        ],
      },
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
                    props: {
                      name: 'name',
                      label: '姓名',
                      placeholder: '请输入姓名',
                      rules: [{ required: true, message: '请输入姓名' }],
                    },
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
                      rules: [
                        { required: true, message: '请输入邮箱' },
                        { type: 'email', message: '请输入有效的邮箱地址' },
                      ],
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
                      rules: [
                        { required: true, message: '请输入手机号' },
                        { type: 'tel', message: '请输入有效的手机号' },
                      ],
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
                      rules: [{ required: true, message: '请选择获客渠道' }],
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
                      rules: [{ maxLength: 500, message: '最多 500 字' }],
                    },
                    children: [],
                  },
                  {
                    id: 'checkbox-agree',
                    type: 'LubanCheckbox',
                    props: {
                      name: 'agree',
                      label: '同意《隐私政策》',
                      rules: [{ required: true, message: '请先同意《隐私政策》' }],
                    },
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
