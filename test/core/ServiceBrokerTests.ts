import * as broker from "../../src/core/ServiceBroker"
import chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

describe('Test delete in ServiceConfigurator', () => {
    describe('Verify add one delete one', () => {
        it('Deleting one after adding one should result in no elements', (done) => {
            const sc = new broker.ServiceConfigutor(); // TODO: fix name mispelling.
            expect(sc.stageIds().length).to.equal(0);

            const testUrl1 = "http://fake.com";
            const testUrl2 = "http://fake2.com";
            const testStageId = "foo";
            const twoMachines = [
                {url: testUrl1, client: null},
                {url: testUrl2, client: null}
            ];
            
            sc.addOrReplace(testStageId, [twoMachines,"xxx"]);
            expect(sc.stageIds().length).to.equal(1);

            sc.delete("dflkdsjflsdlfjsdl", testUrl1);
            sc.delete("dflkdsjflsdlfjsdl", testUrl2);
            assert.equal(sc.stageIds().length, 1);
            assert.equal(sc.get(testStageId)[0].length, 2);

            sc.delete(testStageId, "failMatch");
            assert.equal(sc.stageIds().length, 1);
            assert.equal(sc.get(testStageId)[0].length, 2);

            sc.delete(testStageId, testUrl1);
            assert.equal(sc.stageIds().length, 1);
            assert.equal(sc.get(testStageId)[0].length, 1);

            sc.delete(testStageId, testUrl2);
            assert.equal(sc.stageIds().length, 0);
            assert.equal(sc.has(testStageId), false);

            done();
        });
    });
});