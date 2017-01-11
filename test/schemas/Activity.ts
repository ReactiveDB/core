'use strict'
import { Database, RDBType, Association } from '../index'
import { PostSchema } from './Posts'
import { TaskSchema } from './Task'
import { SubtaskSchema } from './Subtask'

export interface Locales {
  en: {
    title: string
  }
  zh: {
    title: string
  },
  ko: {
    title: string
  }
  zh_tw: {
    title: string
  }
  ja: {
    title: string
  }
}

export interface Voice {
  source: string
  fileType: 'amr'
  fileCategory: string
  fileName: string
  thumbnailUrl: string
  previewUrl: string
  mimeType: string
  downloadUrl: string
  fileSize: number
  duration: number
  fileKey: string
  thumbnail: string
}

export interface ActivitySchema {
  _boundToObjectId: string
  _creatorId: string
  _id: string
  action: string
  boundToObjectType: string
  content: {
    comment?: string
    content?: string
    attachments?: File[]
    voice?: Voice
    mentionsArray?: string[]
    mentions?: {
      [index: string]: string
    }
    attachmentsName?: string
    creator?: string
    executor?: string
    note?: string
    subtask?: string
    count?: string
    dueDate?: string
    linked?: {
      _id: string
      _projectId: string
      _objectId: string
      objectType: string
      title: string
      url: string
    }
    linkedCollection?: {
      _id: string
      title: string
      objectType: 'collection'
    }
    uploadWorks?: {
      _id: string
      fileName: string
      objectType: 'work'
    }[]
    collection: {
      _id: string
      title: string
      objectType: 'collection'
    }
    work?: {
      _id: string
      fileName: string
      objectType: 'work'
    }
  }
  created: number
  locales?: Locales
  entity: PostSchema | TaskSchema | SubtaskSchema
}

export default (db: Database) => db.defineSchema<ActivitySchema>('Activity', {
  _boundToObjectId: {
    type: RDBType.STRING
  },
  _creatorId: {
    type: RDBType.STRING
  },
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  action: {
    type: RDBType.STRING
  },
  boundToObjectType: {
    type: RDBType.STRING
  },
  content: {
    type: RDBType.OBJECT
  },
  created: {
    type: RDBType.NUMBER
  },
  locales: {
    type: RDBType.OBJECT
  },
  entity: {
    type: Association.oneToOne,
    virtual: {
      getName(entity: ActivitySchema) {
        return entity.boundToObjectType
      },
      where(activityTable: lf.schema.Table) {
        return {
          _boundToObjectId: activityTable['_id']
        }
      }
    }
  }
})
