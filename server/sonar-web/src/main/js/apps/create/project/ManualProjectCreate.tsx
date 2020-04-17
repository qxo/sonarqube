/*
 * SonarQube
 * Copyright (C) 2009-2020 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import * as classNames from 'classnames';
import { debounce } from 'lodash';
import * as React from 'react';
import { SubmitButton } from 'sonar-ui-common/components/controls/buttons';
import ValidationInput from 'sonar-ui-common/components/controls/ValidationInput';
import DeferredSpinner from 'sonar-ui-common/components/ui/DeferredSpinner';
import { translate } from 'sonar-ui-common/helpers/l10n';
import { createProject, doesComponentExists } from '../../../api/components';
import CreateProjectPageHeader from './CreateProjectPageHeader';
import './ManualProjectCreate.css';

interface Props {
  branchesEnabled?: boolean;
  currentUser: T.LoggedInUser;
  onProjectCreate: (projectKeys: string[]) => void;
}

interface State {
  projectName: string;
  projectNameChanged: boolean;
  projectNameError?: string;
  projectKey: string;
  projectKeyError?: string;
  submitting: boolean;
  touched: boolean;
  validating: boolean;
}

type ValidState = State & Required<Pick<State, 'projectKey' | 'projectName'>>;

export default class ManualProjectCreate extends React.PureComponent<Props, State> {
  mounted = false;

  constructor(props: Props) {
    super(props);
    this.state = {
      projectKey: '',
      projectName: '',
      projectNameChanged: false,
      submitting: false,
      touched: false,
      validating: false
    };
    this.checkFreeKey = debounce(this.checkFreeKey, 250);
  }

  componentDidMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  checkFreeKey = (key: string) => {
    return doesComponentExists({ component: key })
      .then(alreadyExist => {
        if (this.mounted && key === this.state.projectKey) {
          if (!alreadyExist) {
            this.setState({ projectKeyError: undefined, validating: false });
          } else {
            this.setState({
              projectKeyError: translate('onboarding.create_project.project_key.taken'),
              touched: true,
              validating: false
            });
          }
        }
      })
      .catch(() => {
        if (this.mounted && key === this.state.projectKey) {
          this.setState({ projectKeyError: undefined, validating: false });
        }
      });
  };

  canSubmit(state: State): state is ValidState {
    const { projectKey, projectKeyError, projectName, projectNameError } = state;
    return Boolean(
      projectKeyError === undefined &&
        projectNameError === undefined &&
        projectKey.length > 0 &&
        projectName.length > 0
    );
  }

  handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { state } = this;
    if (this.canSubmit(state)) {
      this.setState({ submitting: true });
      createProject({
        project: state.projectKey,
        name: (state.projectName || state.projectKey).trim()
      }).then(
        ({ project }) => this.props.onProjectCreate([project.key]),
        () => {
          if (this.mounted) {
            this.setState({ submitting: false });
          }
        }
      );
    }
  };

  handleProjectKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const projectKey = event.currentTarget.value || '';
    const projectKeyError = this.validateKey(projectKey);

    this.setState(prevState => {
      const projectName = prevState.projectNameChanged ? prevState.projectName : projectKey;
      return {
        projectKey,
        projectKeyError,
        projectName,
        projectNameError: this.validateName(projectName),
        touched: true,
        validating: projectKeyError === undefined
      };
    });

    if (projectKeyError === undefined) {
      this.checkFreeKey(projectKey);
    }
  };

  handleProjectNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const projectName = event.currentTarget.value;
    this.setState({
      projectName,
      projectNameChanged: true,
      projectNameError: this.validateName(projectName)
    });
  };

  validateKey = (projectKey: string) => {
    return projectKey.length > 400 || !/^[\w-.:]*[a-zA-Z]+[\w-.:]*$/.test(projectKey)
      ? translate('onboarding.create_project.project_key.error')
      : undefined;
  };

  validateName = (projectName: string) => {
    return projectName.length === 0 || projectName.length > 255
      ? translate('onboarding.create_project.display_name.error')
      : undefined;
  };

  render() {
    const {
      projectKey,
      projectKeyError,
      projectName,
      projectNameError,
      submitting,
      touched,
      validating
    } = this.state;
    const { branchesEnabled } = this.props;
    const projectKeyIsInvalid = touched && projectKeyError !== undefined;
    const projectKeyIsValid = touched && !validating && projectKeyError === undefined;
    const projectNameIsInvalid = touched && projectNameError !== undefined;
    const projectNameIsValid = touched && projectNameError === undefined;

    return (
      <>
        <CreateProjectPageHeader
          showBreadcrumb={branchesEnabled}
          title={translate('onboarding.create_project.setup_manually')}
        />

        <div className="create-project-manual">
          <div className="flex-1 huge-spacer-right">
            <form className="manual-project-create" onSubmit={this.handleFormSubmit}>
              <ValidationInput
                className="form-field"
                description={translate('onboarding.create_project.project_key.description')}
                error={projectKeyError}
                help={translate('onboarding.create_project.project_key.help')}
                id="project-key"
                isInvalid={projectKeyIsInvalid}
                isValid={projectKeyIsValid}
                label={translate('onboarding.create_project.project_key')}
                required={true}>
                <input
                  autoFocus={true}
                  className={classNames('input-super-large', {
                    'is-invalid': projectKeyIsInvalid,
                    'is-valid': projectKeyIsValid
                  })}
                  id="project-key"
                  maxLength={400}
                  minLength={1}
                  onChange={this.handleProjectKeyChange}
                  type="text"
                  value={projectKey}
                />
              </ValidationInput>

              <ValidationInput
                className="form-field"
                description={translate('onboarding.create_project.display_name.description')}
                error={projectNameError}
                help={translate('onboarding.create_project.display_name.help')}
                id="project-name"
                isInvalid={projectNameIsInvalid}
                isValid={projectNameIsValid}
                label={translate('onboarding.create_project.display_name')}
                required={true}>
                <input
                  className={classNames('input-super-large', {
                    'is-invalid': projectNameIsInvalid,
                    'is-valid': projectNameIsValid
                  })}
                  id="project-name"
                  maxLength={255}
                  minLength={1}
                  onChange={this.handleProjectNameChange}
                  type="text"
                  value={projectName}
                />
              </ValidationInput>

              <SubmitButton disabled={!this.canSubmit(this.state) || submitting}>
                {translate('set_up')}
              </SubmitButton>
              <DeferredSpinner className="spacer-left" loading={submitting} />
            </form>
          </div>
        </div>
      </>
    );
  }
}
