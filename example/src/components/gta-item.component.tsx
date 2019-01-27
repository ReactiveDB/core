import * as React from 'react'

import { TodoGTA } from './item.gta'
import { TodoContext, TodoController } from '../controller'

export class GtaItem extends React.PureComponent {

  static contextType = TodoGTA
  context!: React.ContextType<typeof TodoGTA>

  onClick = () => {
    // do onlick side effects
    this.context.onClick()
  }

  renderContent = (controller: TodoController) => {
    return (
      <div
        className='gta-item'
        onClick={ this.onClick }
        onMouseDown={ controller.info }
      >
        GTA
      </div>
    )
  }

  render() {
    return (
      <TodoContext.Consumer>
        { this.renderContent }
      </TodoContext.Consumer>
    )
  }

}
