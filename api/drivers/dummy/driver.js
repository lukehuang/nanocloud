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

/* globals Machine, Image, ConfigService */

const Promise = require('bluebird');
const uuid = require('node-uuid');
const http = require('http');

const BaseDriver = require('../driver');
const _ = require('lodash');

let _plazaPort;
let _plazaAddress;

let _sessionOpen = [{
  user: 'username',
  status: false
}]; // Used by fake plaza to hold session status

class DummyDriver extends BaseDriver {

  /**
   * Method executed when the driver is loaded
   *
   * @method initialize
   * @return {Promise}
   */
  initialize() {
    this._machines = {};
    this.dummyPrice = new Promise((resolve) => {
      return resolve({
        products : {
          SUPPEZST6XFGKCM2 : {
            sku : 'SUPPEZST6XFGKCM2',
            productFamily : 'Compute Instance',
            attributes : {
              servicecode : 'AmazonEC2',
              location : 'EU (Frankfurt)',
              locationType : 'AWS Region',
              instanceType : 't2.small',
              instanceFamily : 'General purpose',
              vcpu : '1',
              physicalProcessor : 'Intel Xeon Family',
              clockSpeed : 'Up to 3.3 GHz',
              memory : '2 GiB',
              storage : 'EBS only',
              networkPerformance : 'Low to Moderate',
              processorArchitecture : '32-bit or 64-bit',
              tenancy : 'Shared',
              operatingSystem : 'Windows',
              licenseModel : 'License Included',
              usagetype : 'EUC1-BoxUsage:t2.small',
              operation : 'RunInstances:0002',
              preInstalledSw : 'NA',
              processorFeatures : 'Intel AVX; Intel Turbo',
              price : '0.04'
            }
          }
        }
      });
    });

    var FakePlaza = http.createServer((req, res) => {
      res.writeHead(200, {'Content-Type': 'application/json'});

      if (req.url === '/sessions/Administrator' && req.method === 'GET') {

        let data = { data: [] };
        return Promise.map(_sessionOpen, (session) => {
          data.data.push([
            null,
            session.user,
            null,
            (session.status) ? 'Active' : 'Inactive'
          ]);
          return Promise.resolve();
        })
          .then(() => {
            return res.end(JSON.stringify(data));
          });
      } else if (req.url.substr(0, 10) === '/sessions/' && req.method === 'DELETE') {
        let sessionToClose = req.url.substr(10, req.url.length - 10);
        if (sessionToClose === 'Administrator') {
          let actualSession = _.find(_sessionOpen, (session) => session.user === 'username');
          actualSession.status = false;
        } else {
          _.remove(_sessionOpen, (session) => session.user === sessionToClose);
        }
      } else if (req.url === '/sessionOpen') {
        let actualSession = _.find(_sessionOpen, (session) => session.user === 'username');
        actualSession.status = true;
        req.on('data', (data) => {
          let user = JSON.parse(data.toString()).username;
          actualSession.status = false;
          actualSession = _.find(_sessionOpen, (session) => session.user === user);
          if (actualSession) {
            actualSession.status = true;
          } else {
            _sessionOpen.push({
              user: user,
              status: true
            });
          }
        });
      } else if (req.url === '/sessionClose') {
        let actualSession = _.find(_sessionOpen, (session) => session.user === 'username');
        actualSession.status = false;
      }

      return res.end();
    }).listen(0);

    return Image.update({
      name: 'Default'
    }, {
      instancesSize: 'medium'
    })
      .then(() => {
        if (!FakePlaza) {
          throw new Error('Fake plazaport failed to create');
        } else {
          _plazaPort = FakePlaza.address().port;
          _plazaAddress = '127.0.0.1';

          return Promise.resolve();
        }
      });
  }

  /**
   * Returns the name of the driver used
   *
   * @method name
   * @return {String} The name of the driver
   */
  name() {
    return 'dummy';
  }

  /*
   * Return the created machine
   *
   * @method createMachine
   * @param {Object} options model to be created
   * @return {Promise[Machine]} Machine model created
   */
  createMachine(machine, image) {
    const id = uuid.v4();
    let machineToCreate = new Machine._model({
      id        : id,
      name      : machine.name,
      type      : 'dummy',
      flavor    : image.instancesSize,
      ip        : _plazaAddress,
      username  : 'Administrator',
      plazaport : _plazaPort,
      domain    : '',
      rdpPort   : 3389,
      image     : image.id
    });

    this._machines[id] = machineToCreate;
    return new Promise.resolve(machineToCreate);
  }

  /**
   * Start the specified machine.
   *
   * @method startMachine
   * @return {Promise[Object]}
   */
  startMachine(machine) {
    return Promise.resolve(machine);
  }

  /**
   * Stop the specified machine.
   *
   * @method stopMachine
   * @return {Promise}
   */
  stopMachine(machine) {
    return Promise.resolve(machine);
  }

  destroyMachine(machine) {
    if (this._machines.hasOwnProperty(machine.id)) {
      delete this._machines[machine.id];
      return Promise.resolve();
    } else {
      return Promise.reject(new Error('machine not found'));
    }
  }

  /*
   * Create an image from a machine
   * The image will be used as default image for future execution servers
   *
   * @method createImage
   * @param {Object} Image object with `buildFrom` attribute set to the machine id to create image from
   * @return {Promise[Image]} resolves to the new default image
   */
  createImage(imageToCreate) {

    return Machine.findOne(imageToCreate.buildFrom)
      .then((machine) => {

        let image = new Image._model({
          iaasId: uuid.v4(),
          name: imageToCreate.name,
          buildFrom: imageToCreate.buildFrom,
          password: machine.password,
          instancesSize: 'medium'
        });

        return Promise.resolve(image);
      });
  }

  /**
   * Calculate credit used by a user
   *
   * @method getUserCredit
   * @param {user} user User to calculate credit usage from
   * @return {Promise[number]}
   */
  getUserCredit(user) {

    return this.dummyPrice.then((price) => {
      return new Promise((resolve, reject) => {
        var finalPrice = 0;
        let history = [];
        user.getHistory('aws')
          .then((machineHistory) => {

            /**
             * Here we retrieve all the machines keys of the
             * history we retrived before, matching with machines type
             */
            history = machineHistory;

            var prod = Object.keys(price.products);

            history.forEach((element) => {
              prod.forEach((key) => {
                if (price.products[key].attributes.instanceType === element.type) {
                  element.time = element.time * price.products[key].attributes.price;
                }
              });
            });
          })
          .then(() => {
            history.forEach((element) => {
              finalPrice += element.time;
            });
          })
          .then(() => {
            return resolve(parseFloat(finalPrice.toFixed(4)));
          })
          .catch((err) => {
            return reject(err);
          });
      });
    });
  }

  /**
   * Retrieve the machine's data
   *
   * @method refresh
   * @param {machine} Machine model
   * @return {Promise[Machine]}
   */
  refresh(machine) {
    return new Promise((resolve, reject) => {
      ConfigService.get('dummyBootingState')
        .then((config) => {
          if (machine.status === 'error') {
            reject(machine.status);
          } else if (machine.status === 'stopping') {
            machine.status = 'stopped';
            return resolve(machine);
          } else if (config.dummyBootingState) {
            setTimeout(function() {
              machine.status = 'running';
              return resolve(machine);
            },
            500);
          } else {
            machine.status = 'running';
            return resolve(machine);
          }
        });
    });
  }

  /**
   * Retrieve the machine's password
   *
   * @method getPassword
   * @param {machine} Machine model
   * @return {Promise[String]}
   */
  getPassword(machine) {
    return new Promise((resolve, reject) => {
      if (machine.status === 'error') {
        reject(machine.status);
      }
      return resolve(machine.password);
    });
  }

  instancesSize(size) {
    return size;
  }
}

module.exports = DummyDriver;
