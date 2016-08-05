/**
 * Nanocloud turns any traditional software into a cloud solution, without
 * changing or redeveloping existing source code.
 *
 * Copyright (C) 2016 Nanocloud Software
 *
 * This file is part of Nanocloud.
 *
 * Nanocloud is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Nanocloud is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/* global Machine, ConfigService */

const Promise = require('bluebird');
const Driver = require('../driver');

/**
 * The manual driver just user the specified list of machines. It cannot create
 * nor delete machines.
 *
 * It uses the `ConfigService` variables:
 *  - machines: the machines to use
 * @class ManualDriver
 */
class ManualDriver extends Driver {
  initialize() {
    return ConfigService.get('machines')
      .then((config) => {

        let machines = config.machines.map((machine) => {
          return Machine.create(machine);
        });

        return Promise.all(machines);
      });
  }

  name() {
    return 'manual';
  }
}

module.exports = ManualDriver;
