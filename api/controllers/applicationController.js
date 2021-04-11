'use strict';

var mongoose = require('mongoose'),
  Application = mongoose.model('Applications'),
  Actor = mongoose.model('Actors'),
  Trip = mongoose.model('Trips');
  var authController = require('../controllers/authController');

//MANAGER pueden acceder a todas las applications de su trip
exports.list_all_applications = async function(req, res) {
    var idToken = req.headers['idtoken'];
    var authenticatedUserId = await authController.getUserId(idToken);
    
    Actor.findOne({_id:authenticatedUserId}, async function(err,actor)
    {
      if(err)
        res.status(500).send(err);
      else
      {
        if(actor.role == "EXPLORER")
        {
          /*Application.find({explorer_id:authenticatedUserId},function(err, applications) {
            if (err){
              res.status(500).send(err);
            }
            else{
              res.status(200).json(applications);
            }
          });*/

          try{
            const apps = await Application.aggregate([
              {$match:
                {
                  explorer_id:authenticatedUserId
                }
              },
              {$facet: {
                "PENDING": [
                    {$match:{status:"PENDING"}}
                ],
                "DUE": [
                  {$match:{status:"DUE"}}
                ],
                "REJECTED": [
                  {$match:{status:"REJECTED"}}
                ],
                "ACCEPTED": [
                  {$match:{status:"ACCEPTED"}}
                ],
                "CANCELLED": [
                  {$match:{status:"CANCELLED"}}
                ]
              
              }}
            ]).exec();
            
            if (apps.length > 0) {
                return res.status(200).json(apps);
            } else {
                return res.sendStatus(404);
            }
  
            }
            catch(err)
            {
              console.error(err);
              res.status(500).send(err);
            }
  
        }
        else if(actor.role == "MANAGER")
        {
          //if user is manager    
          var applicationsResult= [];
          
          Application.find({}, async function(err, applications) {
            if (err){
              res.status(500).send(err);
            }
            else{
              applications.forEach(async function(app, index, array){
                //find con and { $and: [{_id: app.trip_id}, {manager_id: authenticatedUserId} ]}
                await Trip.findOne({_id: app.trip_id}, function(err, trip_of_app){
                  if(String(trip_of_app.manager_id) === String(authenticatedUserId))
                  {
                    applicationsResult.push(app);
                  }
                });
                if(index == array.length-1)
                  {
                    res.send(applicationsResult);
                  } 
              }); 
            }
          });
        }
      }
    })
    
    
};


//mostrar a un explorer todas sus applications
//falta añadir ownership para el explorer
//EXPLORER
exports.list_my_applications = async function(req, res) {
  var idToken = req.headers['idtoken'];
  var authenticatedUserId = await authController.getUserId(idToken);
  Applications.find({explorer_id:authenticatedUserId},function(err, applications) {
    if (err){
      res.status(500).send(err);
    }
    else{
      res.json(applications);
    }
  });
};


/* 
exports.search_applications = function(req, res) {
  //check if clerkId param exists
  //check if assigned param exists
  //check if delivered param exists
  //Search depending on params
  console.log('Searching applications depending on params');
  res.send('applications returned from the applications search');
}; */


exports.create_an_application = async function(req, res) {
  //Check that user is a Customer and if not: res.status(403); "an access token is valid, but requires more privileges"
  var new_application = new Application(req.body);
  var idToken = req.headers['idtoken'];
  var authenticatedUserId = await authController.getUserId(idToken);
  new_application.explorer_id=authenticatedUserId;
  new_application.save(function(err, application) {
    if (err){
      if(err.name=='ValidationError') {
          res.status(422).send(err);
      }
      else{
        console.log(application);
        console.log(err);

        res.status(500).send(err);
      }
    }
    else{
      res.status(200).json(application);
    }
  });
};

exports.pay_an_application = async function(req, res) {
  var idToken = req.headers['idtoken'];
  var authenticatedUserId = await authController.getUserId(idToken);
  Application.findOne({_id:req.params.applicationId}, function(err, app) {
    if(String(authenticatedUserId) === String(app.explorer_id))
    {
      if(app.status == 'DUE')
      {
        app.status='ACCEPTED';
        console.log(app);
        Application.findOneAndUpdate({_id:app._id}, app , function(err, app_upd) 
        {
          if(err)
          {
            res.status(500).send(err);
          }
          else
          {
            res.status(200).send(app_upd);
          }
        })
      }
      else
      {
        res.status(403); //Not allowed
        res.send('The user is trying to pay an application with incorrect status');
      }
    }
    else
    {
      res.status(405); //Not allowed
      res.send('The user is trying to pay an application from other manager');
    }
  });
  

};

 exports.read_an_application = async function(req, res) {
  var idToken = req.headers['idtoken'];
  var authenticatedUserId = await authController.getUserId(idToken);
  Trip.findById(req.body.trip_id, function(err, trip){
    if(String(authenticatedUserId) === String(trip.manager_id))
    {
      Application.findById(req.params.applicationId, function(err, application) {
        if (err){
          res.status(500).send(err);
        }
        else{
          res.status(200).json(application);
        }
      });
    }else
    {
      res.status(405); //Not allowed
      res.send('The user is trying to access an application from other manager');
    }
  });
}; 


exports.update_an_application =async function(req, res) {
  //Check if the application has been previously assigned or not
  //Assign the application to the proper clerk that is requesting the assigment
  //when updating delivery moment it must be checked the clerk assignment and to check if it is the proper clerk and if not: res.status(403); "an access token is valid, but requires more privileges"
  var idToken = req.headers['idtoken'];
  var authenticatedUserId = await authController.getUserId(idToken);
  Trip.findById(req.body.trip_id, function(err, trip){
    if(String(authenticatedUserId) === String(trip.manager_id))
    {
      Application.findById(req.params.applicationId, function(err, application) {
    if (err){
      if(err.name=='ValidationError') {
          res.status(422).send(err);
      }
      else{
        res.status(500).send(err);
      }
    }
    else{
      Application.findOneAndUpdate({_id: req.params.applicationId}, req.body, {new: true}, function(err, application) {
          if (err){
            res.status(500).send(err);
          }
          else{
            res.json(application);
          }
        });
      }
  });
    }
    else
    {
      res.status(405); //Not allowed
      res.send('The user is trying to modify an application from other manager');
    }
  });
  
};


exports.delete_an_application = async function(req, res) {
  var idToken = req.headers['idtoken'];
  var authenticatedUserId = await authController.getUserId(idToken);
  Application.findById(req.params.applicationId, function(err, application){
    Trip.findById(application.trip_id, function(err, trip){
      if(String(authenticatedUserId) === String(trip.manager_id))
      {
        Application.deleteOne({ _id: req.params.applicationId}, function(err, app) {
          if (err){
            res.status(500).send(err);
          }
          else{
            res.status(200).json({ message: 'Application successfully deleted' });
          }
        });
      }
      else{res.status(405); //Not allowed
        res.send('The user is trying to delete an application from other manager');}
    });
  });
  
};


