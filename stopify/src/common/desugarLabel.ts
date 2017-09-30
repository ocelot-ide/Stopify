/**
 * Module to add labels to breaks and continues according to tagged AST nodes
 * generated by desugarLoop.
 *
 */

import {NodePath, VisitNode, Visitor} from 'babel-traverse';
import * as t from 'babel-types';
import {While, Break, continueLbl} from '../common/helpers';

const labelVisitor : Visitor = {
  ContinueStatement: function (path: NodePath<t.ContinueStatement>): void {
    const loopParent : NodePath<While<t.Node>> =
      path.findParent(p => p.isWhileStatement() || p.isSwitchStatement());
    const continueLabel = loopParent.node.continue_label;

    const breakStatement = t.breakStatement(continueLabel);
    path.replaceWith(breakStatement);
  },

  BreakStatement: function (path: NodePath<Break<t.BreakStatement>>): void {
    const label = path.node.label;
    if (label === null) {
      const labeledParent : NodePath<Break<t.Node>> =
        path.findParent(p => p.isLoop() || p.isSwitchStatement());

      if (labeledParent === null) {
        return;
      }

      path.node.label = <t.Identifier>labeledParent.node.break_label;
    }
  },
}

module.exports = function() {
  return { visitor: labelVisitor };
};