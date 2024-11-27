import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import byPassCustomValidation from '@salesforce/apex/CopadoCustomValHubController.byPassCustomValidation';
import getUserStoriesForCopadoCusVal from '@salesforce/apex/CopadoCustomValHubController.getUserStoriesForCopadoCusVal';

export default class CopadoCustomValidationHub extends LightningElement {

    showDatatable = false;
    @track datatableRows = [];
    @track datatableColumns = [
        { label: 'User Story ID', fieldName: 'Name', type: 'url', typeAttributes: { label: { fieldName: 'userStoryName'}, target: '_blank' } },
        { label: 'User Story Title', fieldName: 'copado__User_Story_Title__c', type: 'text', sortable:true, initialWidth: 400 },
        { label: 'Project', fieldName: 'copado__Project__r', type: 'text' },
        { label: 'Environment', fieldName: 'copado__Environment__r', type: 'text' },
        { label: 'Sprint', fieldName: 'copado__Sprint__r', type: 'text' },
        { label: 'Developer', fieldName: 'copado__Developer__r', type: 'text' },
        { label: 'Action', type: "button", typeAttributes: {name: 'byPassBtn', label: 'Allow', variant: 'brand' , disabled: { fieldName: 'isButtonDisabled'}}, alignment: "left", cellAttributes: { alignment: 'left' }, fixedWidth: 100, name: 'byPassBtn'}
    ];
     @track staticCodeValTbCols = [
        { label: 'Apex class name', fieldName: 'componentName', wrapText: true, hideDefaultActions: true },
        { label: 'Vulnerability Count', fieldName: 'violationCount', wrapText: true, hideDefaultActions: true }
     ];

    @track userStoryResults = [];
    @track eventDetail;
    @track rowDetail;
    @track isCopadoCusValModalOpen = false;
    @track currUserStoryData = {}
    @track reasonToByPass;
    isDisabled = false;

    //Left Navigation
    @track isCustomValOpen = true;
    @track isStaticCodeOpen = false;

    //Spinner
    showSpinner = false;
    showPopoverSpinner = false;

    //Error
    showErrors = false;
    errorMessage;

    connectedCallback() {
        this.showSpinner = true;
        this.getCustomValidationData('staticCodeValidation');
    }

    getCustomValidationData(validationName){
        this.showSpinner = true;
        this.showDatatable = false;

        getUserStoriesForCopadoCusVal({ customValType: validationName }).then(result => { //getUserStoriesWithCustomVal
            if(result){
                let JSONData = JSON.parse(result);
                this.userStoryResults = JSONData;

                let tableData = [];

                JSONData.map((item, key) => {
                    let userStoryProject = '[Empty]';
                    let userStoryEnvironment = '[Empty]';
                    let userStorySprint = '[Empty]';
                    let userStoryOwner = '[Empty]';
                    let isButtonDisabled = false;

                    // Construct the URL to the user story record
                    const recordUrl = `/lightning/r/copado__User_Story__c/${item.Id}/view`;

                    if(item.copado__Project__r){
                        userStoryProject = item.copado__Project__r.Name;
                    }
                    if(item.copado__Environment__r){
                        userStoryEnvironment = item.copado__Environment__r.Name;
                    }
                    if(item.copado__Sprint__r){
                        userStorySprint = item.copado__Sprint__r.Name;
                    }
                    if(item.copado__Developer__r){
                        userStoryOwner = item.copado__Developer__r.Name;
                    }
                    //Remove added for testing
                    if(item.Name == 'US-0004219'){//|| item.Name == 'US-0004215'
                        item.Has_lower_version__c = false;
                        item.Restrict_Promote_New_Field_on_Account__c = false;
                        item.Apex_validation_details__c = '123';
                        item.New_Account_Fied_Validation_Details__c = '';
                    }

                    if(validationName == 'staticCodeValidation'){
                        //Check if the button should be disabled - If the user story has passed code analysis and has static code validation details
                        if(item.Is_Code_Analysis_Passed__c && item.Static_Code_Validation_Detail__c != null && item.Static_Code_Validation_Detail__c != ''){
                            isButtonDisabled = true;
                        }
                    }

                    tableData.push({
                        Id: item.Id,
                        Name: recordUrl,
                        userStoryName: item.Name,
                        copado__User_Story_Title__c: item.copado__User_Story_Title__c,
                        copado__Project__r: userStoryProject,
                        copado__Environment__r: userStoryEnvironment,
                        copado__Sprint__r: userStorySprint,
                        copado__Developer__r: userStoryOwner,
                        isButtonDisabled: isButtonDisabled
                    });
                });

                if(tableData.length > 0){
                    this.datatableRows = tableData;

                    this.showSpinner = false;
                    this.showDatatable = true;
                }else{
                    //Show the error
                    this.showSpinner = false
                    this.showErrors = true;
                    this.errorMessage = 'No User Story Data Found';
                }

            }
        }).catch(error => {
            this.showSpinner = false;
            this.showErrors = true;
            this.errorMessage = 'Error Occurred while fetching User Story Data';
        });
    }

    handleRowAction(event){
        this.eventDetail = {};
        this.rowDetail = {};
        this.eventDetail = JSON.parse(JSON.stringify(event.detail));
        this.rowDetail = this.eventDetail.childRowEvent.detail;

        if (this.rowDetail.action.name === 'byPassBtn') {
            this.openModal(this.rowDetail.row.Id);
        }else{
            this.showToast('Error Occurred', 'Invalid Action', 'error');
        }
    }

    openModal(userStoryId){
        this.showSpinner = true;
        this.refreshPopoverObject();

        try{
            if(this.userStoryResults.length > 0){
                const currUserStoryDetail = this.userStoryResults.find(dataItem => dataItem.Id == userStoryId);

                console.log('Current User Story Detail: ', currUserStoryDetail);
                
                if(currUserStoryDetail){
                    this.currUserStoryData.userStoryId = currUserStoryDetail.Id;
                    this.currUserStoryData.userStoryName = currUserStoryDetail.Name;
                    this.currUserStoryData.userStoryOwner = currUserStoryDetail.copado__Developer__r ? currUserStoryDetail.copado__Developer__r.Name : '[Empty]';
                    this.currUserStoryData.userStoryTitle = currUserStoryDetail.copado__User_Story_Title__c;

                    //Check if the user story has passed code analysis
                    this.currUserStoryData.staticCodeValDetails = currUserStoryDetail.Static_Code_Validation_Detail__c ? JSON.parse(currUserStoryDetail.Static_Code_Validation_Detail__c) : [];

                    if(this.currUserStoryData.staticCodeValDetails.length > 0){
                        let componentsWithViolationList = [];
                        this.currUserStoryData.staticCodeValDetails.map(item => {
                            if(item.isViolationDetected){
                                componentsWithViolationList.push(item);
                            }
                        });
                        this.currUserStoryData.staticCodeValDetails = componentsWithViolationList;
                        this.currUserStoryData.isCodeAnalysisPassed = this.currUserStoryData.staticCodeValDetails.length > 0 ? true : false;
                    }
                    this.showSpinner = false;
                    this.isCopadoCusValModalOpen = true;

                }else{
                    this.showSpinner = false;
                    this.showToast('Error Occurred', 'Current User Story details cannot be extracted', 'error');
                }

            }else{
                this.showSpinner = false;
                this.showToast('Error Occurred', 'No User Story Data Found', 'error');
            }

        }catch(error){
            console.log('COPADO CUSTOM VALIDATION HUB ERROR: ', error);
            this.showSpinner = false;
            this.showToast('Error Occurred', 'Error Occurred while extracting User Story Data', 'error');
        }
    }

    refreshPopoverObject(){
         this.currUserStoryData = {
            userStoryId: '',
            userStoryName: '',
            userStoryOwner: '',
            userStoryTitle: '',
            isCodeAnalysisPassed: false,
            staticCodeValDetails: []
        }
        this.isDisabled = false;

        this.showErrors = false;
        this.errorMessage = '';
    }

    handleCloseBtn(event){
        this.isCopadoCusValModalOpen = false;
    }

    handleReasonChange(event){
        this.reasonToByPass = event.target.value;
    }

    handleByPassValidation(event){
        const isInputsCorrect = [...this.template.querySelectorAll('lightning-textarea')]
        .reduce((validSoFar, inputField) => {
            let validity = inputField.reportValidity();
            return validSoFar && validity;
        }, true);

        //Get the validation type
        let validationName = null;
        if(this.isCustomValOpen){
            validationName = 'customValidation';
        }else if(this.isStaticCodeOpen){
            validationName = 'staticCodeValidation';
        }

        if(isInputsCorrect && this.currUserStoryData.userStoryId && validationName){
            this.showPopoverSpinner = true;
            this.isDisabled = true;

            byPassCustomValidation({userStoryId: this.currUserStoryData.userStoryId, validationType: validationName, byPassReason: this.reasonToByPass}).then(result => {
                if(result){
                    this.showPopoverSpinner = false;

                    if(result.isException){
                        this.showToast('Error Occurred', result.message, 'error');
                    }else{
                        this.showToast('Success', 'Custom Validation Bypassed Successfully', 'success');
                        window.location.reload();
                    }
                }
            }).catch(error => {
                this.showToast('Error Occurred', 'Custom Validation Bypass Failed', 'error');
                this.showPopoverSpinner = false;
            });
        }else{
            if(this.currUserStoryData.userStoryId == null || this.currUserStoryData.userStoryId == ''){
                this.showToast('Error Occurred', 'Necessary user story detail is not found.', 'error');
            }
        }
    }

    showToast(title, message, variant){
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    openCustomManagement(event){
        let validationType = event.target.name;
        if(event.target.name == 'staticCodeValidation'){
            this.isCustomValOpen = false;
            this.isStaticCodeOpen = true;
        }
        if(validationType){
            this.getCustomValidationData(validationType);
        }

    }
}